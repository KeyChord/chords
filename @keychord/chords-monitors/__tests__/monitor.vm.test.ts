import { expect, test } from "bun:test";
import { launchMacOSFixture, macOSUITestsEnabled, runChordScript } from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "monitor chords focus a real visible window without moving or clicking it",
  async () => {
    const source = new URL("./MonitorFixture.swift", import.meta.url);
    const target = await launchMacOSFixture(source, "dev.keychord.monitor-fixture");
    try {
      const cover = await launchMacOSFixture(source, "dev.keychord.monitor-fixture.cover");
      try {
        const result = await runChordScript(new URL("./monitor.integration.ts", import.meta.url), [
          target.bundleId,
          target.output,
          cover.bundleId,
        ]);
        expect(result.stdout).toContain("monitor-macos-focus-ok");
      } finally {
        await cover.close();
      }
    } finally {
      await target.close();
    }
  },
  120_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "monitor resolution validates actual modes and restores a supported change",
  async () => {
    const result = await runChordScript(
      new URL("./monitor-resolution.integration.ts", import.meta.url),
    );
    console.log(result.stdout.trim());
    expect(result.stdout).toContain("monitor-resolution-macos-ok");
  },
  120_000,
);
