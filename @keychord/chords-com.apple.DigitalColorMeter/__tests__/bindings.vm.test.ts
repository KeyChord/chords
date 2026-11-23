import { expect, test } from "bun:test";
import {
  runCommand,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.DigitalColorMeter";
const definition = Bun.TOML.parse(
  await Bun.file(
    new URL("../chords/com/apple/DigitalColorMeter/macos.toml", import.meta.url),
  ).text(),
) as { chords: Record<string, unknown> };
const sequences = Object.keys(definition.chords)
  .filter((key) => !key.startsWith("?"))
  .sort();

const toggles = {
  vx: "Lock X",
  vy: "Lock Y",
  vl: "Lock Position",
  vu: "Update Continuously",
  vm: "Show Mouse Location",
};

const magnifications = { m1: "1x", m2: "2x", m4: "4x", m8: "8x" };
const formats = { fd: "as Decimal", fh: "as Hexadecimal", fp: "as Percentage" };

test("every Digital Color Meter binding has a behavior case", () => {
  expect(sequences).toEqual(
    [
      ...Object.keys(toggles),
      ...Object.keys(magnifications),
      ...Object.keys(formats),
      "ct",
      "ci",
    ].sort(),
  );
});

test.skipIf(!macOSUITestsEnabled)(
  "Digital Color Meter changes the aperture and numeric display and copies the sampled color",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        await waitFor(async () =>
          (await probe.window(bundleId)).title === "Digital Color Meter" ? true : undefined,
        );
        const marked = async (...path: string[]) =>
          Boolean((await probe.menu(bundleId, "View", ...path)).mark);
        const waitForMark = (value: boolean, ...path: string[]) =>
          waitFor(async () => ((await marked(...path)) === value ? true : undefined));

        for (const [sequence, title] of Object.entries(toggles)) {
          const before = await marked(title);
          await app.runChecked(sequence);
          await waitForMark(!before, title);
          await app.runChecked(sequence);
          await waitForMark(before, title);
        }

        for (const [menu, cases] of [
          ["Magnification", Object.entries(magnifications)],
          ["Display Values", Object.entries(formats)],
        ] as const) {
          let original: string | undefined;
          for (const [, target] of cases) {
            if (await marked(menu, target)) original = target;
          }
          expect(original).toBeDefined();
          try {
            for (const [sequence, target] of cases) {
              if (await marked(menu, target)) {
                const alternative = cases.find(([, title]) => title !== target)![1];
                await probe.press(bundleId, "View", menu, alternative);
                await waitForMark(true, menu, alternative);
              }
              await app.runChecked(sequence);
              await waitForMark(true, menu, target);
            }
          } finally {
            if (original) await probe.press(bundleId, "View", menu, original);
          }
        }

        // Read the local guest pasteboard independently of Digital Color Meter's AX tree.
        const pasteboard = async () =>
          JSON.parse(
            (
              await runCommand([
                "/usr/bin/osascript",
                "-l",
                "JavaScript",
                "-e",
                'ObjC.import("AppKit"); const p = $.NSPasteboard.generalPasteboard; JSON.stringify({ generation: p.changeCount, types: ObjC.deepUnwrap(p.types) ?? [] });',
              ])
            ).stdout,
          ) as { generation: number; types: string[] };

        const textBefore = await pasteboard();
        await app.runChecked("ct");
        await waitFor(async () => {
          const state = await pasteboard();
          if (state.generation <= textBefore.generation) return;
          const { stdout } = await runCommand(["/usr/bin/pbpaste"]);
          return /^\s*[-+\d.#%A-Fa-f]+(?:[\s,]+[-+\d.#%A-Fa-f]+){0,2}\s*$/.test(stdout)
            ? true
            : undefined;
        });

        const imageBefore = await pasteboard();
        await app.runChecked("ci");
        await waitFor(async () => {
          const state = await pasteboard();
          return state.generation > imageBefore.generation &&
            state.types.some((type) => ["public.tiff", "public.png"].includes(type))
            ? true
            : undefined;
        });
      }),
    );
  },
  120_000,
);
