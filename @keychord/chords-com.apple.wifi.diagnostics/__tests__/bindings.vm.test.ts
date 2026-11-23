import { expect, test } from "bun:test";

import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.wifi.diagnostics";
const tools = {
  gi: "Info",
  gl: "Logs",
  gs: "Scan",
  gp: "Performance",
  gd: "Diagnostics",
};

test("every Wireless Diagnostics binding has a behavior case", async () => {
  const file = Bun.file(
    new URL("../chords/com/apple/wifi/diagnostics/macos.toml", import.meta.url),
  );
  const definition = Bun.TOML.parse(await file.text()) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["ga", "fo", ...Object.keys(tools)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Wireless Diagnostics routes assistant, file, and tool window chords",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        await waitFor(
          () => probe.menu(bundleId, "Window", "Assistant").catch(() => undefined),
          12_000,
        );
        const title = "Wireless Diagnostics";
        const assistant = async () =>
          (await probe.windows(bundleId)).find((window) => window.title === title);
        await waitFor(assistant, 12_000);
        await probe.key(46, 1 << 20); // Command-M
        await waitFor(async () => ((await assistant())?.minimized ? true : undefined));
        await app.runChecked("ga");
        await waitFor(async () => {
          const window = await probe.window(bundleId);
          return window.title === title && !window.minimized ? true : undefined;
        }, 12_000);

        await app.runChecked("fo");
        await waitFor(async () =>
          flattenAX(await probe.windows(bundleId, 6)).find(
            (node) => node.role === "AXButton" && node.title === "Open",
          ),
        );
        await probe.pressControl(bundleId, "AXButton", "Cancel");
        await waitFor(async () =>
          (await probe.window(bundleId)).title === title ? true : undefined,
        );

        for (const [sequence, tool] of Object.entries(tools)) {
          if ((await probe.menu(bundleId, "Window", tool)).enabled === false) {
            await app.expectFailure(sequence, /Menu item .*is disabled/);
            continue;
          }
          expect((await probe.windows(bundleId)).some((window) => window.title === tool)).toBe(
            false,
          );
          await app.runChecked(sequence);
          await waitFor(
            async () => (await probe.windows(bundleId)).find((window) => window.title === tool),
            12_000,
          );
          await probe.raiseWindow(bundleId, tool);
          await probe.key(13, 1 << 20); // Command-W
          await waitFor(async () =>
            (await probe.windows(bundleId)).some((window) => window.title === tool)
              ? undefined
              : true,
          );
        }
      }),
    );
  },
  180_000,
);
