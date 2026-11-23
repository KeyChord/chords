import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.Image_Capture";
const toggles = { vs: "Sidebar", vt: "Toolbar" };
const deviceActions = { el: "Rotate Left", ed: "Delete" };
const caseKeys = [...Object.keys(toggles), ...Object.keys(deviceActions)];

test("every Image Capture binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Image_Capture/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((sequence) => !sequence.startsWith("?"))
      .sort(),
  ).toEqual(caseKeys.sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Image Capture changes view controls and reports unavailable device actions",
  () =>
    withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await probe.activate(bundleId);
        await waitFor(
          async () =>
            flattenAX(await probe.windows(bundleId, 7)).find((node) =>
              [node.title, node.value, node.description].some(
                (label) =>
                  typeof label === "string" &&
                  /^No camera or scanner (connected|selected)\.?$/i.test(label),
              ),
            ),
          15_000,
        );
        for (const [sequence, label] of Object.entries(toggles)) {
          const menu = async () =>
            flattenAX([await probe.menu(bundleId, "View")]).find(
              (node) => node.title === "Show " + label || node.title === "Hide " + label,
            );
          const before = await waitFor(menu);
          if (before.enabled === false) {
            await app.expectFailure(sequence, /Menu item .*is disabled/);
            continue;
          }
          try {
            await app.runChecked(sequence);
            await waitFor(async () => {
              const after = await menu();
              return after && (after.title !== before.title || after.mark !== before.mark)
                ? true
                : undefined;
            });
          } finally {
            const after = await menu();
            if (after && (after.title !== before.title || after.mark !== before.mark)) {
              await app.runChecked(sequence);
              await waitFor(async () => {
                const restored = await menu();
                return restored?.title === before.title && restored?.mark === before.mark
                  ? true
                  : undefined;
              });
            }
          }
        }

        for (const [sequence, title] of Object.entries(deviceActions)) {
          expect((await probe.menu(bundleId, "Edit", title)).enabled).toBe(false);
          await app.expectFailure(sequence, /Menu item .*is disabled/);
        }
      }),
    ),
  90_000,
);
