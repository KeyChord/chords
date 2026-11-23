import { expect, test } from "bun:test";

import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.DirectoryUtility";
const unavailable = {
  cd: "Disconnect",
  fs: "Save Changes",
};

test("every Directory Utility binding has a behavior case", async () => {
  const file = Bun.file(
    new URL("../chords/com/apple/DirectoryUtility/macos.toml", import.meta.url),
  );
  const definition = Bun.TOML.parse(await file.text()) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["cc", ...Object.keys(unavailable)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Directory Utility opens the connection prompt and guards disconnected commands",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        await waitFor(
          () => probe.menu(bundleId, "File", "Connect…").catch(() => undefined),
          12_000,
        );
        const connectionPrompt = async () =>
          flattenAX(await probe.windows(bundleId, 6)).find(
            (node) => node.role === "AXButton" && node.title === "Connect",
          );

        for (const [sequence, title] of Object.entries(unavailable)) {
          expect((await probe.menu(bundleId, "File", title)).enabled).toBe(false);
          await app.expectFailure(sequence, /Menu item .*is disabled/);
        }

        expect(await connectionPrompt()).toBeUndefined();
        await app.runChecked("cc");
        await waitFor(connectionPrompt, 12_000);
        await probe.pressControl(bundleId, "AXButton", "Cancel");
        await waitFor(async () => (!(await connectionPrompt()) ? true : undefined));
      }),
    );
  },
  90_000,
);
