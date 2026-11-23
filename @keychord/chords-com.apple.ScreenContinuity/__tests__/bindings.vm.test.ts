import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const mirroring = "com.apple.ScreenContinuity";
const shortcuts = {
  gh: "1",
  ga: "2",
  gs: "3",
  gc: "4",
  "s=": "+",
  "s-": "-",
  s0: "0",
  si: "9",
};

test("all iPhone Mirroring keyboard chords have a native control case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/ScreenContinuity/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, { shortcut?: string }> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => definition.chords[key].shortcut)
      .sort(),
  ).toEqual(Object.keys(shortcuts).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "iPhone Mirroring exposes the keyboard commands for this macOS version",
  async () => {
    const { stdout } = await runCommand(["/usr/bin/sw_vers", "-productVersion"]);
    const major = Number(stdout.split(".")[0]);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(mirroring);
        const menu = () => probe.menu(mirroring, "View");
        await waitFor(() => menu().catch(() => undefined));
        const view = flattenAX([await menu()]);
        for (const [sequence, key] of Object.entries(shortcuts)) {
          if (major < 27 && (sequence === "gc" || sequence === "si")) continue;
          const item = view.find((node) => node.key === key || (key === "+" && node.key === "="));
          expect(item, sequence).toBeDefined();
          // A fresh VM has no paired iPhone. The app publishes these equivalents while the
          // corresponding device controls are unavailable, which the chord must respect.
          expect(item?.enabled, sequence).toBe(false);
          await app.run(sequence);
        }
        expect(await probe.front()).toBe(mirroring);
      }),
    );
  },
  90_000,
);
