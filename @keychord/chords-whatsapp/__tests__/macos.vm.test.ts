import { expect, test } from "bun:test";
import { launchMacOSFixture, macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";
import { runCommand } from "@keychord/chordtest/macos";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-whatsapp: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url, []),
  300_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "WhatsApp actions activate their target and never act on the covering app",
  async () => {
    const source = new URL("./WhatsAppFixture.swift", import.meta.url);
    const target = await launchMacOSFixture(source, "dev.keychord.whatsapp-fixture");
    try {
      const cover = await launchMacOSFixture(source, "dev.keychord.whatsapp-cover");
      try {
        const result = await runCommand(
          [
            process.env.CHORD_NATIVE_TEST_HOST!,
            "bun",
            Bun.fileURLToPath(new URL("./whatsapp.integration.ts", import.meta.url)),
            target.bundleId,
            target.output,
            cover.bundleId,
            cover.output,
          ],
          { timeout: 180_000 },
        );
        expect(result.stdout).toContain("whatsapp-app-targeting-ok");
      } finally {
        await cover.close();
      }
    } finally {
      await target.close();
    }
  },
  240_000,
);
