import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.DiskUtility";
const volume = "Chordtest Utility Volume";
const views = { vd: "Show All Devices", vv: "Show Only Volumes" };
const toggles = { vs: "Sidebar", vp: "APFS Snapshots" };
const images = { io: /^Open$/, in: /^Save$/, if: /^(?:Choose|Open)$/ };
const sheets = { df: "Run", de: "Erase", dr: "Restore", dp: "Partition", da: "Add", dd: "Delete" };

test("every Disk Utility binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/DiskUtility/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(
    [
      "di",
      "du",
      "dm",
      ...Object.keys(views),
      ...Object.keys(toggles),
      ...Object.keys(images),
      ...Object.keys(sheets),
    ].sort(),
  );
});

test.skipIf(!macOSUITestsEnabled)(
  "Disk Utility changes views and manages a disposable APFS image",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const scratch = await mkdtemp(join(tmpdir(), "chordtest-disk-utility-"));
        const image = join(scratch, "fixture.dmg");
        let device: string | undefined;
        try {
          await runCommand([
            "/usr/bin/hdiutil",
            "create",
            "-size",
            "256m",
            "-fs",
            "APFS",
            "-layout",
            "GPTSPUD",
            "-volname",
            volume,
            image,
          ]);
          const { stdout } = await runCommand(["/usr/bin/hdiutil", "attach", "-nobrowse", image]);
          device = stdout.match(/^\/dev\/disk\d+\b/m)?.[0];
          expect(device).toBeDefined();
          await probe.activate(bundle);
          const view = (title: string) => probe.menu(bundle, "View", title);
          await waitFor(() => view(views.vv).catch(() => undefined), 15_000);

          const titleForToggle = async (name: string) => {
            const menu = await probe.menu(bundle, "View");
            return flattenAX([menu]).find((node) => node.title?.endsWith(name))?.title;
          };
          if ((await titleForToggle("Sidebar")) === "Show Sidebar") {
            await probe.press(bundle, "View", "Show Sidebar");
          }
          const selectVolume = () =>
            waitFor(async () => {
              if (
                !(await probe.selectRow(bundle, volume).then(
                  () => true,
                  () => false,
                ))
              )
                return;
              const item = await probe.menu(bundle, "File", "Get Info");
              return item.enabled ? true : undefined;
            }, 15_000);

          await selectVolume();
          const originalView = (await view(views.vd)).mark ? views.vd : views.vv;
          if (originalView === views.vd) await probe.press(bundle, "View", views.vv);
          for (const [key, title] of Object.entries(views)) {
            await waitFor(async () => ((await view(title)).mark ? undefined : true));
            await app.runChecked(key);
            await waitFor(async () => ((await view(title)).mark ? true : undefined));
          }
          for (const [key, name] of Object.entries(toggles)) {
            await selectVolume();
            const before = await waitFor(() => titleForToggle(name));
            await app.runChecked(key);
            await waitFor(async () => {
              const after = await titleForToggle(name);
              return after && after !== before ? true : undefined;
            });
            await app.runChecked(key);
            await waitFor(async () => ((await titleForToggle(name)) === before ? true : undefined));
          }

          const sheetButton = async (label: RegExp) =>
            flattenAX(await probe.windows(bundle, 8)).find(
              (node) => node.role === "AXButton" && label.test(node.title ?? ""),
            );
          const cancel = async (key: string, label: RegExp) => {
            const button = () => sheetButton(label);
            expect(await button()).toBeUndefined();
            await app.runChecked(key);
            try {
              await waitFor(button, 15_000);
            } finally {
              if (await sheetButton(/^Cancel$/)) {
                await probe.pressControl(bundle, "AXButton", "Cancel");
              } else {
                await probe.key(53);
              }
            }
            await waitFor(async () => (!(await button()) ? true : undefined));
          };

          for (const [key, label] of Object.entries(images)) await cancel(key, label);
          await selectVolume();
          const beforeInfo = (await probe.windows(bundle)).length;
          await app.runChecked("di");
          await waitFor(async () => {
            const windows = await probe.windows(bundle, 5);
            return windows.length > beforeInfo &&
              flattenAX(windows).some(
                (node) => node.title === "Mount Point" || node.title === "Info",
              )
              ? true
              : undefined;
          });
          await probe.key(13, 1 << 20); // Command-W closes the info window.
          await waitFor(async () =>
            (await probe.windows(bundle)).length === beforeInfo ? true : undefined,
          );

          const { stdout: initialInfo } = await runCommand(["/usr/sbin/diskutil", "info", volume]);
          const volumeDevice = initialInfo.match(/Device Node:\s+(\/dev\/disk[\ds]+)/)?.[1];
          expect(volumeDevice).toBeDefined();
          const mounted = async () => {
            const { stdout: info } = await runCommand([
              "/usr/sbin/diskutil",
              "info",
              volumeDevice!,
            ]);
            return /Mount Point:\s+\/Volumes\//.test(info);
          };
          expect(await mounted()).toBe(true);
          await selectVolume();
          await app.runChecked("du");
          await waitFor(async () => (!(await mounted()) ? true : undefined));
          await selectVolume();
          await app.runChecked("dm");
          await waitFor(async () => ((await mounted()) ? true : undefined));

          // Every disk operation is presented for this fixture only and canceled at its prompt.
          for (const [key, label] of Object.entries(sheets)) {
            await selectVolume();
            if (key === "dd") {
              const { stdout: info } = await runCommand(["/usr/sbin/diskutil", "info", volume]);
              const container = info.match(/APFS Container(?: Reference)?:\s+(disk\d+)/)?.[1];
              expect(container).toBeDefined();
              await runCommand([
                "/usr/sbin/diskutil",
                "apfs",
                "addVolume",
                container!,
                "APFS",
                "Chordtest Delete Volume",
              ]);
              await waitFor(
                async () =>
                  await probe.selectRow(bundle, "Chordtest Delete Volume").then(
                    () => true,
                    () => undefined,
                  ),
                15_000,
              );
            }
            await cancel(key, new RegExp("^" + label + "$"));
          }
          if (originalView !== views.vv) await probe.press(bundle, "View", originalView);
        } finally {
          try {
            if (device) await runCommand(["/usr/bin/hdiutil", "detach", device]);
          } finally {
            await rm(scratch, { recursive: true, force: true });
          }
        }
      }),
    );
  },
  240_000,
);
