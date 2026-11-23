import { expect, test } from "bun:test";
import {
  flattenAX,
  type AXNode,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.audio.AudioMIDISetup";
const definition = Bun.TOML.parse(
  await Bun.file(
    new URL("../chords/com/apple/audio/AudioMIDISetup/macos.toml", import.meta.url),
  ).text(),
) as { chords: Record<string, unknown> };
const sequences = Object.keys(definition.chords)
  .filter((key) => !key.startsWith("?"))
  .sort();

const windows = {
  ga: "Audio Devices",
  gm: "MIDI Studio",
  gn: "Network Device Browser",
};

test("every Audio MIDI Setup binding has a behavior case", () => {
  expect(sequences).toEqual([...Object.keys(windows), "gs", "vc", "vh", "vs"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Audio MIDI Setup opens its three windows and changes toolbar visibility",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        const focusedWindow = (title: string, depth = 0) =>
          waitFor(async () => {
            const window = await probe.window(bundleId, depth);
            return window.title === title ? window : undefined;
          }, 12_000);
        await focusedWindow("Audio Devices");

        for (const [sequence, title] of Object.entries(windows)) {
          const target = (await probe.windows(bundleId)).find((window) => window.title === title);
          if (target) {
            await probe.raiseWindow(bundleId, title);
            await focusedWindow(title);
            await probe.key(13, 1 << 20);
            await waitFor(async () =>
              (await probe.windows(bundleId)).every((window) => window.title !== title)
                ? true
                : undefined,
            );
          }
          await app.runChecked(sequence);
          await focusedWindow(title);
        }

        await probe.raiseWindow(bundleId, "MIDI Studio");
        const toolbar = (window: AXNode) =>
          flattenAX([window]).find((element) => element.role === "AXToolbar");
        const waitForToolbar = (visible: boolean) =>
          waitFor(async () =>
            Boolean(toolbar(await probe.window(bundleId, 4))) === visible ? true : undefined,
          );
        await focusedWindow("MIDI Studio");
        const originallyVisible = Boolean(toolbar(await probe.window(bundleId, 4)));
        try {
          if (!originallyVisible) await probe.press(bundleId, "View", "Show Toolbar");
          await waitForToolbar(true);
          await app.runChecked("vh");
          await waitForToolbar(false);
          await app.runChecked("vs");
          await waitForToolbar(true);

          await app.runChecked("vc");
          await waitFor(async () =>
            flattenAX(await probe.windows(bundleId, 6)).find(
              (element) => element.role === "AXSheet",
            ),
          );
          await probe.pressControl(bundleId, "AXButton", "Done");
          await waitFor(async () =>
            flattenAX(await probe.windows(bundleId, 5)).every(
              (element) => element.role !== "AXSheet",
            )
              ? true
              : undefined,
          );
        } finally {
          if (!originallyVisible && toolbar(await probe.window(bundleId, 4))) {
            await probe.press(bundleId, "View", "Hide Toolbar");
          }
        }

        await app.runChecked("gs");
        try {
          await waitFor(async () =>
            (await probe.windows(bundleId, 5)).find(
              (window) =>
                /settings|preferences/i.test(window.title ?? "") ||
                flattenAX([window]).some(
                  (element) => element.title === "When application launches:",
                ),
            ),
          );
        } finally {
          await probe.key(13, 1 << 20);
        }
      }),
    );
  },
  120_000,
);
