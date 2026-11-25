import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

import { activateMagnifier, bundle, zoom } from "./magnifier";

test("every Magnifier binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Magnifier/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["fn", "fo", ...Object.keys(zoom)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Magnifier chords create a window and open the document picker",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await activateMagnifier(probe);
        const count = async () => (await probe.windows(bundle)).length;

        const originalWindows = await probe.windows(bundle);
        const existingWindows = new Set(originalWindows.map(({ id, title }) => id ?? title));
        const newWindow = async () =>
          (await probe.windows(bundle)).find(({ id, title }) => !existingWindows.has(id ?? title));
        const before = originalWindows.length;
        try {
          await app.runChecked("fn");
          await waitFor(async () => ((await count()) === before + 1 ? true : undefined), 12_000);
        } finally {
          const window = await newWindow();
          const identifier = window?.id ?? window?.title;
          if (identifier) await probe.closeWindow(bundle, identifier);
          await waitFor(async () => ((await count()) === before ? true : undefined));
        }

        const picker = async () =>
          flattenAX(await probe.windows(bundle, 8)).find(
            (node) => node.role === "AXButton" && [node.title, node.description].includes("Open"),
          );
        expect(await picker()).toBeUndefined();
        try {
          await app.runChecked("fo");
          await waitFor(picker, 12_000);
        } finally {
          if (await picker()) await probe.pressControl(bundle, "AXButton", "Cancel");
          await waitFor(async () => ((await picker()) ? undefined : true));
        }
      }),
    );
  },
  120_000,
);
