import { test } from "bun:test";
import {
  launchMacOSFixture,
  macOSUITestsEnabled,
  runChordScript,
  testMacOSPackage,
} from "@keychord/chordtest";
import { expect } from "bun:test";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-menu: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url, []),
  300_000,
);

if (macOSUITestsEnabled) await import("./tray-native.test");

test.skipIf(!macOSUITestsEnabled)(
  "native menu handler invokes items in a controlled AppKit app",
  async () => {
    const fixture = await launchMacOSFixture(
      new URL("./MenuFixture.swift", import.meta.url),
      "dev.keychord.menu-fixture",
    );
    try {
      const result = await runChordScript(new URL("./menu.integration.ts", import.meta.url), [], {
        MENU_FIXTURE_OUTPUT: fixture.output,
      });
      expect(result.stdout).toContain("menu integration passed");
    } finally {
      await fixture.close();
    }
  },
  60_000,
);
