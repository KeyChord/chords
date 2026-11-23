import { expect, test } from "bun:test";

import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.Ticket-Viewer";
const noIdentity = {
  td: "Remove Identity",
  ts: "Set as Default",
  tp: "Change Password",
};
const diagnostics = "Diagnostic Information";

test("every Ticket Viewer binding has a behavior case", async () => {
  const file = Bun.file(new URL("../chords/com/apple/Ticket-Viewer/macos.toml", import.meta.url));
  const definition = Bun.TOML.parse(await file.text()) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["ta", "ti", ...Object.keys(noIdentity)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Ticket Viewer opens the identity form and handles an empty ticket cache",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        await waitFor(
          () => probe.menu(bundleId, "Ticket", "Add Identity").catch(() => undefined),
          12_000,
        );
        const windows = async () => flattenAX(await probe.windows(bundleId, 6));
        const identityForm = async () =>
          (await windows()).find(
            (node) =>
              node.role === "AXCheckBox" && node.title === "Remember password in my keychain",
          );

        for (const [sequence, title] of Object.entries(noIdentity)) {
          expect((await probe.menu(bundleId, "Ticket", title)).enabled).toBe(false);
          await app.expectFailure(sequence, /Menu item .*is disabled/);
        }

        if ((await probe.menu(bundleId, "Ticket", diagnostics)).enabled === false) {
          await app.expectFailure("ti", /Menu item .*is disabled/);
        } else {
          await app.runChecked("ti");
          await waitFor(async () =>
            (await windows()).find((node) => /^diagnostic information$/i.test(node.title ?? "")),
          );
          await probe.pressControl(bundleId, "AXButton", "Close");
        }

        expect(await identityForm()).toBeUndefined();
        await app.runChecked("ta");
        await waitFor(identityForm, 12_000);
        await probe.pressControl(bundleId, "AXButton", "Cancel");
        await waitFor(async () => (!(await identityForm()) ? true : undefined));
      }),
    );
  },
  120_000,
);
