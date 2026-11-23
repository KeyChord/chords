import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type MacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.Magnifier";
const zoom = {
  zi: "Zoom In",
  zo: "Zoom Out",
  za: "Zoom to Fit",
};

test("every Magnifier binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Magnifier/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["fn", "fo", "gs", ...Object.keys(zoom)].sort());
});

async function activateMagnifier(probe: MacOSProbe) {
  await probe.activate(bundle);
  const window = await waitFor(() => probe.window(bundle, 7).catch(() => undefined), 15_000);
  if (
    flattenAX([window]).some(
      (node) => node.role === "AXButton" && [node.title, node.description].includes("Continue"),
    )
  ) {
    await probe.pressControl(bundle, "AXButton", "Continue");
    await waitFor(() => probe.menu(bundle, "File", "New").catch(() => undefined), 12_000);
  }
}

test.skipIf(!macOSUITestsEnabled)(
  "Magnifier chords create a window and open the document picker and settings",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await activateMagnifier(probe);
        const count = async () => (await probe.windows(bundle)).length;

        const before = await count();
        try {
          await app.runChecked("fn");
          await waitFor(async () => ((await count()) === before + 1 ? true : undefined), 12_000);
        } finally {
          if ((await count()) > before) await probe.key(13, 1 << 20);
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
          if (await picker()) await probe.key(53);
          await waitFor(async () => ((await picker()) ? undefined : true));
        }

        const settings = async () =>
          (await probe.windows(bundle)).find((node) => /\bSettings\b/.test(node.title ?? ""));
        expect(await settings()).toBeUndefined();
        try {
          await app.runChecked("gs");
          await waitFor(settings, 12_000);
        } finally {
          if (await settings()) await probe.key(13, 1 << 20);
          await waitFor(async () => ((await settings()) ? undefined : true));
        }
      }),
    );
  },
  120_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "Magnifier zoom chords reach the live image controls",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await activateMagnifier(probe);
        const imageMenu = (item: string) => probe.menu(bundle, "Image", item);
        const scale = async () =>
          flattenAX(await probe.windows(bundle, 9)).find(
            (node) =>
              node.role === "AXSlider" &&
              [node.title, node.description, node.id].some((label) => /zoom/i.test(label ?? "")),
          )?.value;

        // Verify available actions via the slider. The camera-free guest can instead
        // expose disabled commands, which must produce the specific menu error.
        const initial = await scale();
        try {
          for (const [sequence, item] of Object.entries(zoom)) {
            if ((await imageMenu(item)).enabled === false) {
              await app.expectFailure(sequence, /Menu item .* is disabled/);
              continue;
            }

            const before = await waitFor(scale, 12_000);
            if (sequence === "za" && before === initial) {
              const adjustment = (await imageMenu(zoom.zi)).enabled ? zoom.zi : zoom.zo;
              await probe.press(bundle, "Image", adjustment);
              await waitFor(async () => {
                const value = await scale();
                return value !== before ? value : undefined;
              });
            }
            const from = await waitFor(scale);
            await app.runChecked(sequence);
            await waitFor(async () => {
              const value = await scale();
              return value !== from ? value : undefined;
            }, 12_000);
          }
        } finally {
          if (initial !== undefined && (await imageMenu(zoom.za)).enabled) {
            await probe.press(bundle, "Image", zoom.za);
          }
        }
      }),
    );
  },
  120_000,
);
