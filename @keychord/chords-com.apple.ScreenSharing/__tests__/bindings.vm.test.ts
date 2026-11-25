import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.ScreenSharing";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/ScreenSharing/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };
const sequences = Object.keys(definition.chords)
  .filter((key) => !key.startsWith("?"))
  .sort();

const remoteOnly = {
  cs: ["Connection", "Save As…"],
  vs: ["View", "Turn Scaling Off"],
  va: ["View", "Adaptive Quality"],
  vf: ["View", "Full Quality"],
};

test("every Screen Sharing binding has a behavior case", () => {
  expect(sequences).toEqual(["gs", "cn", "co", "wc", "wf", ...Object.keys(remoteOnly)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Screen Sharing opens its local connection tools and rejects remote commands without a session",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        const matchesWindow = async (pattern: RegExp) =>
          (await probe.windows(bundleId)).find((item) => pattern.test(item.title ?? ""));
        const window = (pattern: RegExp) => waitFor(() => matchesWindow(pattern), 12_000);
        const connections = /^(All )?Connections$/;
        const connectionWindow = await matchesWindow(connections);
        if (connectionWindow?.title) {
          await probe.closeWindow(bundleId, connectionWindow.title);
          await waitFor(async () => ((await matchesWindow(connections)) ? undefined : true));
        }
        await app.runChecked("wc");
        await window(connections);

        const dialog = async (button: string) =>
          flattenAX(await probe.windows(bundleId, 8)).find(
            (item) => item.role === "AXButton" && item.title === button,
          );
        for (const [sequence, button] of [
          ["cn", "Connect"],
          ["co", "Open"],
        ]) {
          await app.runChecked(sequence);
          const cancel = await waitFor(() => dialog("Cancel"));
          expect(cancel.role).toBe("AXButton");
          await waitFor(() => dialog(button));
          await probe.pressControl(bundleId, "AXButton", "Cancel");
          await waitFor(async () => ((await dialog("Cancel")) ? undefined : true));
        }

        const previousWindows = await probe.windows(bundleId);
        const settingsWindow = async () =>
          (await probe.windows(bundleId)).find(
            (item) =>
              item.title && !previousWindows.some((previous) => previous.title === item.title),
          );
        await app.runChecked("gs");
        const settings = await waitFor(settingsWindow, 12_000);
        await probe.closeWindow(bundleId, settings.title!);
        await waitFor(async () => ((await settingsWindow()) ? undefined : true));

        const transferMenu = await probe.menu(bundleId, "Window", "File Transfers");
        if (transferMenu.enabled) {
          await app.runChecked("wf");
          const transfers = await window(/file transfers/i);
          await probe.closeWindow(bundleId, transfers.title!);
        } else {
          await app.expectFailure("wf", /Menu item .* is disabled/i);
        }

        for (const [sequence, path] of Object.entries(remoteOnly)) {
          const item = await probe.menu(bundleId, ...path);
          expect(item.enabled).toBeFalse();
          await app.expectFailure(sequence, /Menu item .* is disabled/i);
        }
      }),
    );
  },
  120_000,
);
