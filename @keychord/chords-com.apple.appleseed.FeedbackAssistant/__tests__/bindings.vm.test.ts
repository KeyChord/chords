import { expect, test } from "bun:test";

import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.appleseed.FeedbackAssistant";
const accountCommands = {
  fn: ["File", "New Feedback"],
  fo: ["File", "Open"],
  fe: ["File", "Export Feedback"],
  fr: ["Window", "Refresh All"],
};

test("every Feedback Assistant binding has a behavior case", async () => {
  const file = Bun.file(
    new URL("../chords/com/apple/appleseed/FeedbackAssistant/macos.toml", import.meta.url),
  );
  const definition = Bun.TOML.parse(await file.text()) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["gm", "gc", "vs", ...Object.keys(accountCommands)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Feedback Assistant opens its windows and reports commands unavailable while signed out",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await runCommand([
      "/usr/bin/defaults",
      "write",
      bundleId,
      "WelcomeWindowShown",
      "-bool",
      "true",
    ]);
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        const main = async () =>
          (await probe.windows(bundleId)).find((window) =>
            /^(Feedback Assistant|Welcome to Feedback Assistant|Sign In)$/.test(window.title ?? ""),
          );
        await waitFor(main, 15_000);
        for (const [sequence, path] of Object.entries(accountCommands)) {
          expect((await probe.menu(bundleId, ...path)).enabled).toBe(false);
          await app.expectFailure(sequence, /Menu item .*is disabled/);
        }

        const settings = ["Feedback Assistant", "Preferences…"];
        if ((await probe.menu(bundleId, ...settings)).enabled === false) {
          await app.expectFailure("gc", /Menu item .*is disabled/);
        } else {
          await app.runChecked("gc");
          await waitFor(async () =>
            flattenAX(await probe.windows(bundleId, 6)).find(
              (node) => node.role === "AXButton" && node.title === "Reset warnings",
            ),
          );
          await probe.key(13, 1 << 20); // Command-W
        }

        const sidebar = async () =>
          flattenAX([await probe.menu(bundleId, "Window")]).find((node) =>
            /^(Show|Hide) Sidebar$/.test(node.title ?? ""),
          );
        const initial = await waitFor(sidebar);
        if (initial.enabled === false) {
          await app.expectFailure("vs", /Menu item .*is disabled/);
        } else {
          await app.runChecked("vs");
          await waitFor(async () => {
            const item = await sidebar();
            return item && item.title !== initial.title ? item : undefined;
          });
          await app.runChecked("vs");
          await waitFor(async () =>
            (await sidebar())?.title === initial.title ? true : undefined,
          );
        }

        if ((await probe.menu(bundleId, "Window", "Feedback Assistant")).enabled === false) {
          await app.expectFailure("gm", /Menu item .*is disabled/);
        } else {
          const target = await waitFor(main);
          await probe.key(46, 1 << 20); // Command-M
          await waitFor(async () => ((await main())?.minimized ? true : undefined));
          await app.runChecked("gm");
          await waitFor(async () => {
            const window = await probe.window(bundleId);
            return window.title === target.title && !window.minimized ? true : undefined;
          }, 12_000);
        }
      }),
    );
  },
  180_000,
);
