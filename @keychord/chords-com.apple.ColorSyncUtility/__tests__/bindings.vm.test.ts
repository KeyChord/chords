import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  flattenAX,
  runCommand,
  type AXNode,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.ColorSyncUtility";
const definition = Bun.TOML.parse(
  await Bun.file(
    new URL("../chords/com/apple/ColorSyncUtility/macos.toml", import.meta.url),
  ).text(),
) as { chords: Record<string, unknown> };
const sequences = Object.keys(definition.chords)
  .filter((key) => !key.startsWith("?"))
  .sort();

const openPanel = (windows: AXNode[]) =>
  flattenAX(windows).find((element) => element.role === "AXButton" && element.title === "Open");

test("every ColorSync Utility binding has a behavior case", () => {
  expect(sequences).toEqual(["fc", "fn", "fo", "fp", "fs"]);
});

test.skipIf(!macOSUITestsEnabled)(
  "ColorSync Utility opens a utility window and the file picker, and saves and prints a test image",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    const directory = await mkdtemp(join(tmpdir(), "chordtest-colorsync-"));
    const imagePath = join(directory, "ColorSync Chord Test.png");
    const profile = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";
    try {
      const pixel =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMIqFgAAAKEAWkyLad+AAAAAElFTkSuQmCC";
      await Bun.write(imagePath, Uint8Array.fromBase64(pixel));
      await runCommand(["/usr/bin/sips", "--embedProfile", profile, imagePath]);

      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(bundleId);
          const utilityWindowCount = async () =>
            (await probe.windows(bundleId)).filter((window) => window.title === "ColorSync Utility")
              .length;
          const before = await utilityWindowCount();
          await app.runChecked("fn");
          await waitFor(async () => ((await utilityWindowCount()) > before ? true : undefined));
          await probe.key(13, 1 << 20);

          await app.runChecked("fo");
          await waitFor(async () => openPanel(await probe.windows(bundleId, 8)));
          await probe.key(53);
          await waitFor(async () =>
            openPanel(await probe.windows(bundleId, 8)) ? undefined : true,
          );

          await probe.activate(bundleId, imagePath);
          await waitFor(async () =>
            (await probe.window(bundleId)).title?.includes("ColorSync Chord Test")
              ? true
              : undefined,
          );
          try {
            for (const [sequence, button] of [
              ["fs", "Save"],
              ["fc", "Save"],
              ["fp", "Print"],
            ]) {
              const dialogButton = async () =>
                flattenAX(await probe.windows(bundleId, 9)).find(
                  (element) => element.role === "AXButton" && element.title === button,
                );
              expect(await dialogButton()).toBeUndefined();
              await app.runChecked(sequence);
              await waitFor(dialogButton, 12_000);
              await probe.key(53);
              await waitFor(async () => ((await dialogButton()) ? undefined : true));
            }
          } finally {
            await probe.key(13, 1 << 20);
          }
        }),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  120_000,
);
