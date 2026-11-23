import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.FolderActionsSetup";
const cases = ["fa(.+)"];

test("every Folder Actions Setup binding has a behavior case", async () => {
  const file = Bun.file(
    new URL("../chords/com/apple/FolderActionsSetup/macos.toml", import.meta.url),
  );
  const definition = Bun.TOML.parse(await file.text()) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...cases].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Folder Actions Setup offers scripts to attach to an existing folder",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    const folder = await mkdtemp(join(tmpdir(), "chordtest-folder-action-"));
    try {
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(bundleId);
          await waitFor(async () =>
            (await probe.windows(bundleId)).find(
              (window) => window.title === "Folder Actions Setup",
            ),
          );
          const attach = async () =>
            flattenAX(await probe.windows(bundleId, 7)).find(
              (node) => node.role === "AXButton" && node.title === "Attach",
            );
          expect(await attach()).toBeUndefined();
          await app.runChecked(`fa${folder}`);
          await waitFor(attach, 12_000);
          await probe.pressControl(bundleId, "AXButton", "Cancel");
          await waitFor(async () => (!(await attach()) ? true : undefined));
        }),
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  },
  90_000,
);
