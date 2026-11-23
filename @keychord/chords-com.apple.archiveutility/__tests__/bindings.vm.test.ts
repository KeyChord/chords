import { expect, test } from "bun:test";

import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.archiveutility";
const dialogs = {
  fc: "Archive",
  fe: "Expand",
};

test("every Archive Utility binding has a behavior case", async () => {
  const file = Bun.file(new URL("../chords/com/apple/archiveutility/macos.toml", import.meta.url));
  const definition = Bun.TOML.parse(await file.text()) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...Object.keys(dialogs), "gc"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Archive Utility opens its two file choosers and settings",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const windows = async () => flattenAX(await probe.windows(bundleId, 6));
        const hasButton = async (title: string) =>
          (await windows()).some((node) => node.role === "AXButton" && node.title === title);
        const pickerClosed = async (title: string) =>
          !(await probe.running(bundleId)) || !(await hasButton(title)) || undefined;

        for (const [sequence, button] of Object.entries(dialogs)) {
          await probe.activate(bundleId);
          await waitFor(() => probe.menu(bundleId, "File").catch(() => undefined), 12_000);
          expect(await hasButton(button)).toBe(false);
          await app.runChecked(sequence);
          await waitFor(async () => ((await hasButton(button)) ? true : undefined), 12_000);
          // Always cancel the picker so neither action touches an existing archive.
          await probe.pressControl(bundleId, "AXButton", "Cancel");
          await waitFor(() => pickerClosed(button));
        }

        await probe.activate(bundleId);
        await app.runChecked("gc");
        await waitFor(async () =>
          (await windows()).find(
            (node) => node.role === "AXCheckBox" && node.title === "Reveal archive in Finder",
          ),
        );
        await probe.key(13, 1 << 20); // Command-W
      }),
    );
  },
  120_000,
);
