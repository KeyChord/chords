import { expect, test } from "bun:test";
import {
  launchMacOSFixture,
  macOSUITestsEnabled,
  runChordScript,
  testMacOSPackage,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-windows: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url, []),
  300_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "standard AppKit windows support native frame, snapping and overflow",
  async () => {
    const fixture = await launchMacOSFixture(
      new URL("./StandardWindowFixture.swift", import.meta.url),
      "dev.keychord.standard-window-fixture",
    );
    try {
      const result = await runChordScript(
        new URL("./standard-window.integration.ts", import.meta.url),
        [fixture.bundleId, fixture.output],
      );
      expect(result.stdout).toContain("standard-window-geometry-ok");
    } finally {
      await fixture.close();
    }
  },
  120_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "window chords change real AppKit bounds without changing the captured app",
  async () => {
    const source = new URL("./WindowFixture.swift", import.meta.url);
    const target = await launchMacOSFixture(source, "dev.keychord.window-fixture");
    try {
      const cover = await launchMacOSFixture(source, "dev.keychord.window-cover-fixture");
      try {
        const result = await runChordScript(new URL("./window.integration.ts", import.meta.url), [
          target.bundleId,
          target.output,
          cover.bundleId,
          cover.output,
        ]);
        expect(result.stdout).toContain("window-macos-geometry-ok");
      } finally {
        await cover.close();
      }
    } finally {
      await target.close();
    }
  },
  120_000,
);
