import { expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { basename } from "node:path";
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
    // The Chord CLI parses physical keys, so the fixture path uses lowercase ASCII.
    const folder = `/tmp/chordtest-folder-action-${crypto.randomUUID()}`;
    await mkdir(folder);
    try {
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(bundleId);
          await waitFor(async () =>
            (await probe.windows(bundleId)).find(
              (window) => window.title === "Folder Actions Setup",
            ),
          );
          const nodes = async () => flattenAX(await probe.windows(bundleId, 11));
          const button = async (title: string) =>
            (await nodes()).find((node) => node.role === "AXButton" && node.title === title);
          expect(await button("Attach")).toBeUndefined();
          await app.runChecked(`fa${folder}`);
          const dialog = await waitFor(
            async () => (await button("Run Service")) ?? (await button("Attach")),
            12_000,
          );
          if (dialog.title === "Run Service") {
            await probe.activate(bundleId);
            await probe.clickControl(bundleId, "AXButton", "Run Service");
          }
          await waitFor(() => button("Attach"), 12_000);
          try {
            const controls = await nodes();
            expect(
              controls.some(
                (node) => node.role === "AXTextField" && node.value === basename(folder),
              ),
            ).toBe(true);
            expect(controls.some((node) => node.value === "Choose a Script to Attach:")).toBe(true);
          } finally {
            await probe.clickControl(bundleId, "AXButton", "Cancel");
            await waitFor(async () => !(await button("Attach")) || undefined);
          }
        }),
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  },
  90_000,
);
