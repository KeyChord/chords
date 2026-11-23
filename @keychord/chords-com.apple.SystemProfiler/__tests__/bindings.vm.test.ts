import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.SystemProfiler";
const dialogs = { ro: "Open", rs: "Save", rp: "Print" };
const detail = { rl: "Show Less Information", rm: "Show More Information" };

test("every System Information binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/SystemProfiler/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["rn", "ff", ...Object.keys(dialogs), ...Object.keys(detail)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "System Information shows and searches a system report and opens report dialogs",
  async () => {
    const guestVersion = Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim();
    console.log("guest macOS", guestVersion);
    expect(guestVersion).toMatch(/^27\./);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(async () => {
          const item = await probe
            .menu(bundle, "File", "Show System Report")
            .catch(() => undefined);
          return item?.enabled ? item : undefined;
        }, 20_000);

        // Starting with closed report windows proves the command creates the report.
        while ((await probe.window(bundle)).role === "AXWindow") {
          const before = (await probe.windows(bundle)).length;
          await probe.key(13, 1 << 20); // Command-W
          await waitFor(async () =>
            (await probe.windows(bundle)).length < before ? true : undefined,
          );
        }
        const report = async () =>
          flattenAX([await probe.window(bundle, 8)]).find((node) =>
            [node.title, node.value].some((label) => label === "Hardware"),
          );
        await app.runChecked("rn");
        await waitFor(report, 30_000);

        const hasDetailAction = async (title: string) =>
          Boolean((await probe.menu(bundle, "File", title).catch(() => undefined))?.enabled);
        if (await hasDetailAction(detail.rm)) await probe.press(bundle, "File", detail.rm);
        await waitFor(async () => ((await hasDetailAction(detail.rl)) ? true : undefined), 30_000);
        await app.runChecked("rl");
        await waitFor(async () => ((await hasDetailAction(detail.rm)) ? true : undefined), 30_000);
        await app.runChecked("rm");
        await waitFor(async () => ((await hasDetailAction(detail.rl)) ? true : undefined), 30_000);

        const dialogButton = async (name: string) =>
          flattenAX(await probe.windows(bundle, 8)).find(
            (node) => node.role === "AXButton" && node.title === name,
          );
        for (const [key, button] of Object.entries(dialogs)) {
          expect(await dialogButton(button)).toBeUndefined();
          await app.runChecked(key);
          await waitFor(() => dialogButton(button), 20_000);
          await probe.key(53); // Escape
          await waitFor(async () => (!(await dialogButton(button)) ? true : undefined));
        }

        const findUI = async () => {
          const windows = await probe.windows(bundle);
          const findWindow = windows.find((window) => /find/i.test(window.title ?? ""));
          if (findWindow) return findWindow;
          const focus = await probe.focus(bundle);
          if (
            focus.subrole === "AXSearchField" ||
            (focus.role === "AXTextField" && /find|search/i.test(focus.description ?? ""))
          ) {
            return focus;
          }
        };
        expect(await findUI()).toBeUndefined();
        await app.runChecked("ff");
        await waitFor(findUI);
        await probe.key(53);
        if ((await probe.windows(bundle)).some((window) => /find/i.test(window.title ?? ""))) {
          await probe.key(13, 1 << 20);
        }
        await waitFor(async () => (!(await findUI()) ? true : undefined));
      }),
    );
  },
  180_000,
);
