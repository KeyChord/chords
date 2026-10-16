import { expect, test } from "bun:test";
import {
  launchMacOSFixture,
  macOSUITestsEnabled,
  runChordScript,
  testMacOSPackage,
} from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-dock: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url, []),
  300_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "application chords switch real apps using a stable native cycle",
  async () => {
    const fixtures = [];
    try {
      for (const name of ["first", "hidden", "current", "helper"]) {
        fixtures.push(
          await launchMacOSFixture(
            new URL("./ApplicationFixture.swift", import.meta.url),
            `dev.keychord.application-cycle-${name}`,
          ),
        );
      }
      const result = await runChordScript(
        new URL("./application.integration.ts", import.meta.url),
        [
          ...fixtures.slice(0, 3).flatMap((fixture) => [fixture.bundleId, fixture.output]),
          fixtures[3].bundleId,
        ],
      );
      expect(result.stdout).toContain("application-cycle-ok");
    } finally {
      for (const fixture of fixtures.reverse()) await fixture.close();
    }
  },
  180_000,
);
