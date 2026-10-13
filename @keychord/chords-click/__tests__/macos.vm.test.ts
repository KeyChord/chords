import { test } from "bun:test";
import {
  launchMacOSFixture,
  macOSUITestsEnabled,
  runChordScript,
  testMacOSPackage,
} from "@keychord/chordtest";
import { expect } from "bun:test";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-click: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url),
  300_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "real AppKit windows receive the complete click sequence",
  async () => {
    const source = new URL("../../chordtest/src/fixtures/WindowFixture.swift", import.meta.url);
    const target = await launchMacOSFixture(source, "dev.keychord.click-fixture");
    try {
      const cover = await launchMacOSFixture(source, "dev.keychord.click-cover-fixture");
      try {
        const result = await runChordScript(new URL("./click.integration.ts", import.meta.url), [
          target.bundleId,
          target.output,
          cover.bundleId,
          cover.output,
        ]);
        expect(result.stdout).toContain("click-macos-events-ok");
      } finally {
        await cover.close();
      }
    } finally {
      await target.close();
    }
  },
  60_000,
);
