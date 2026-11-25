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
  type AXNode,
} from "@keychord/chordtest";

const bundle = "com.apple.DiskUtility";
const volume = "Chordtest Utility Volume";
const views = { vd: "Show All Devices", vv: "Show Only Volumes" };
const toggles = { vs: "Sidebar", vp: "APFS Snapshots" };
const images = { io: /^Open$/, in: /^Save$/, if: /^(?:Choose|Open)$/ };
const sheets = { df: "Run", de: "Erase", dr: "Restore", dp: "Apply", da: "Add", dd: "Delete" };

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
            "1g",
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
          const focusDiskUtility = async () => {
            await probe.activate(bundle);
            await waitFor(async () => (await probe.front()) === bundle || undefined, 15_000);
          };
          await focusDiskUtility();
          const view = (title: string) => probe.menu(bundle, "View", title);
          await waitFor(() => view(views.vv).catch(() => undefined), 15_000);

          // The guest's first-run notification banners can cover the toolbar at its default position.
          const main = await waitFor(async () => {
            const window = await probe.window(bundle);
            return window.subrole === "AXStandardWindow" && window.position && window.size
              ? window
              : undefined;
          });
          const [windowX, windowY] = main.position!;
          const titleBarOffset = main.size![0] * 0.46;
          if (windowX > 18 || windowY < 245) {
            await probe.dragPoints(
              [windowX + titleBarOffset, windowY + 28],
              [18 + titleBarOffset, Math.max(windowY, 245) + 28],
            );
            await waitFor(async () => {
              const window = await probe.window(bundle);
              return window.position && window.position[0] <= 28 && window.position[1] >= 218
                ? true
                : undefined;
            }).catch(async (cause) => {
              throw new Error(
                "Disk Utility could not move clear of the guest notification area: " +
                  JSON.stringify(await probe.window(bundle)),
                { cause },
              );
            });
          }

          const titleForToggle = async (name: string) => {
            const menu = await probe.menu(bundle, "View");
            return flattenAX([menu]).find((node) => node.title?.endsWith(name))?.title;
          };
          if ((await titleForToggle("Sidebar")) === "Show Sidebar") {
            await probe.press(bundle, "View", "Show Sidebar");
          }
          const volumeRow = async () =>
            flattenAX(await probe.windows(bundle, 12)).find(
              ({ role, children }) =>
                role === "AXRow" &&
                flattenAX(children ?? []).some(
                  ({ title, value }) => title === volume || value === volume,
                ),
            );
          const selectVolume = async (focusRow = false) => {
            const label = await waitFor(async () => {
              const row = await volumeRow();
              return flattenAX(row?.children ?? []).find(
                ({ title, value, position, size }) =>
                  (title === volume || value === volume) && position && size,
              );
            }, 15_000);
            const detailsHeading = (node: AXNode): boolean => {
              if (node.role === "AXOutline") return false;
              return (
                (["AXHeading", "AXStaticText"].includes(node.role ?? "") &&
                  [node.title, node.description, node.value].includes(volume)) ||
                (node.children ?? []).some(detailsHeading)
              );
            };
            const selected = async () =>
              (await volumeRow())?.selected || detailsHeading(await probe.window(bundle, 8));
            if (focusRow || !(await selected())) {
              await probe.clickPoint(
                label.position![0] + label.size![0] / 2,
                label.position![1] + label.size![1] / 2,
              );
              if (!(await selected())) await probe.selectRow(bundle, volume);
            }
            await waitFor(async () => {
              if (!(await selected())) return;
              return (await probe.menu(bundle, "File", "Get Info")).enabled || undefined;
            }, 15_000).catch(async (cause) => {
              throw new Error(
                "Disk Utility did not select the fixture volume: " +
                  JSON.stringify({
                    row: await volumeRow(),
                    window: await probe.window(bundle),
                    infoEnabled: (
                      await probe.menu(bundle, "File", "Get Info").catch(() => undefined)
                    )?.enabled,
                  }),
                { cause },
              );
            });
          };

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

          const sheetButton = async (label: RegExp, dialogOnly: boolean) => {
            const nodes = flattenAX(await probe.windows(bundle, 8));
            const candidates = dialogOnly
              ? flattenAX(
                  nodes.filter(({ role, subrole }) => role === "AXSheet" || subrole === "AXDialog"),
                )
              : nodes;
            return candidates.find(
              (node) => node.role === "AXButton" && label.test(node.title ?? ""),
            );
          };
          const cancel = async (key: string, label: RegExp, dialogOnly = false) => {
            const button = () => sheetButton(label, dialogOnly);
            expect(await button()).toBeUndefined();
            await app.runChecked(key);
            try {
              await waitFor(button, 15_000).catch(async (cause) => {
                const dialogs = flattenAX(await probe.windows(bundle, 8)).filter(
                  (node) => node.role === "AXSheet" || node.subrole === "AXDialog",
                );
                const controls = flattenAX(dialogs)
                  .filter((node) => node.role === "AXButton" || node.role === "AXStaticText")
                  .map(({ title, description, value }) => title ?? description ?? value);
                throw new Error(
                  "Disk Utility did not show " +
                    label +
                    " in a dialog: " +
                    JSON.stringify(controls),
                  { cause },
                );
              });
            } finally {
              if (await sheetButton(/^Cancel$/, dialogOnly)) {
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
          await probe.closeWindow(bundle, `${volume} Info`);
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
          const failures: Error[] = [];
          const setMounted = async (key: "dm" | "du", expected: boolean) => {
            const toolbarLabel = expected ? "Mount" : "Unmount";
            const reached = async () => (await mounted()) === expected || undefined;
            expect(await mounted()).toBe(!expected);
            await selectVolume(key === "du");
            try {
              if (key === "du") {
                await waitFor(async () => {
                  const button = await probe.windowElement(bundle, toolbarLabel, "AXButton");
                  return (await probe.front()) === bundle && button?.enabled ? button : undefined;
                });
              }
              await app.runChecked(key);
              // Disk Arbitration may finish unmounting after the toolbar action returns.
              await waitFor(reached, key === "du" ? 30_000 : 10_000);
              console.log(`Disk Utility ${key} passed`);
            } catch (cause) {
              const dialogs = flattenAX(await probe.windows(bundle, 8)).filter(
                ({ role, subrole }) => role === "AXSheet" || subrole === "AXDialog",
              );
              const reference = await probe.windowElement(bundle, toolbarLabel, "AXButton");
              const cursor = await probe.cursor();
              const artifacts = process.env.CHORD_TESTING_ARTIFACTS;
              if (artifacts) {
                await runCommand([
                  "/usr/sbin/screencapture",
                  "-x",
                  join(artifacts, "disk-utility-" + key + "-before-reference.png"),
                ]).catch(() => undefined);
              }
              let changedByReferenceClick = false;
              if (
                (await probe.front()) === bundle &&
                reference?.position &&
                reference.size?.every((dimension) => dimension > 0) &&
                reference.enabled &&
                !dialogs.length &&
                !(await reached())
              ) {
                const [x, y] = reference.position;
                const [width, height] = reference.size;
                await probe.clickPoint(x + width / 2, y + height / 2);
                changedByReferenceClick = Boolean(await waitFor(reached, 5_000).catch(() => false));
              }
              const failure = new Error(
                `Disk Utility ${key} did not reach its requested mount state: ` +
                  JSON.stringify({ volume, dialogs, reference, cursor, changedByReferenceClick }),
                { cause },
              );
              failures.push(failure);
              console.error(failure.message);
              // Restore only the mounted state of the disposable fixture for later dialogs.
              if (!(await reached())) {
                // Recover the exact disposable image device returned by hdiutil.
                const imageDevices = stdout.split("\n").map((line) => line.trim().split(/\s+/)[0]);
                if (!imageDevices.includes(volumeDevice!)) throw failure;
                await runCommand([
                  "/usr/sbin/diskutil",
                  expected ? "mount" : "unmount",
                  volumeDevice!,
                ]);
                await waitFor(reached);
              }
            }
          };
          await setMounted("du", false);
          await setMounted("dm", true);

          // Every disk operation is presented for this fixture only and canceled at its prompt.
          for (const [key, label] of Object.entries(sheets)) {
            try {
              await focusDiskUtility();
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
              await cancel(key, new RegExp("^" + label + "$"), true);
              console.log(`Disk Utility ${key} passed`);
            } catch (cause) {
              const failure = new Error(
                `Disk Utility ${key} did not open its dialog while ${await probe.front()} was active`,
                { cause },
              );
              failures.push(failure);
              console.error(failure.message);
            }
          }
          if (originalView !== views.vv) await probe.press(bundle, "View", originalView);
          if (failures.length) {
            throw new AggregateError(failures, "Disk Utility disk behavior failed");
          }
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
