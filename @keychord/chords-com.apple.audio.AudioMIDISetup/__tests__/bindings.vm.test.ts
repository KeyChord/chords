import { expect, test } from "bun:test";
import {
  flattenAX,
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
        const menu = (title: string) =>
          probe.menu(bundleId, "Window", title).catch(() => undefined);
        const audio = await waitFor(async () => {
          if (!(await menu("Hide Audio Devices"))?.enabled) return;
          return (await probe.window(bundleId)).title;
        }, 12_000);
        for (const [sequence, title] of Object.entries(windows)) {
          const targetTitle = sequence === "ga" ? audio : title;
          const target = (await probe.windows(bundleId)).find(
            (window) => window.title === targetTitle,
          );
          if (target) {
            await probe.closeWindow(bundleId, targetTitle);
            await waitFor(async () => (await menu("Show " + title))?.enabled || undefined);
          }
          await app.runChecked(sequence);
          if (sequence === "ga") {
            await waitFor(async () => (await menu("Hide Audio Devices"))?.enabled || undefined);
            await focusedWindow(audio);
          } else {
            await focusedWindow(title);
          }
        }

        await probe.raiseWindow(bundleId, "MIDI Studio");
        const toolbar = async () => {
          const view = await probe.menu(bundleId, "View");
          return flattenAX([view]).find(
            ({ title, enabled }) =>
              enabled && (title === "Show Toolbar" || title === "Hide Toolbar"),
          )?.title;
        };
        const waitForToolbar = (visible: boolean) =>
          waitFor(async () =>
            (await toolbar()) === (visible ? "Hide Toolbar" : "Show Toolbar") ? true : undefined,
          );
        await focusedWindow("MIDI Studio");
        const originallyVisible = (await waitFor(toolbar)) === "Hide Toolbar";
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
          if (!originallyVisible && (await toolbar()) === "Hide Toolbar") {
            await probe.press(bundleId, "View", "Hide Toolbar");
          }
        }

        const prior = new Set((await probe.windows(bundleId)).map(({ title }) => title));
        const settings = async () =>
          (await probe.windows(bundleId)).find(({ title }) => title && !prior.has(title));
        await app.runChecked("gs");
        try {
          await waitFor(settings);
        } finally {
          const window = await settings();
          if (window?.title) {
            await probe.closeWindow(bundleId, window.title);
            await waitFor(async () => ((await settings()) ? undefined : true));
          }
        }
      }),
    );
  },
  120_000,
);
