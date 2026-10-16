import { expect, test } from "bun:test";
import { launchMacOSFixture, macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";
import { runCommand } from "@keychord/chordtest/macos";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-navigation: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url, []),
  300_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "global navigation replaces WhatsApp back/next and selects and dismisses dialog choices",
  async () => {
    const source = new URL(
      "../../chords-whatsapp/__tests__/WhatsAppFixture.swift",
      import.meta.url,
    );
    const target = await launchMacOSFixture(source, "dev.keychord.navigation-fixture");
    try {
      const cover = await launchMacOSFixture(source, "dev.keychord.navigation-cover");
      try {
        const result = await runCommand(
          [
            process.env.CHORD_NATIVE_TEST_HOST!,
            "bun",
            Bun.fileURLToPath(new URL("./navigation.integration.ts", import.meta.url)),
            target.bundleId,
            target.output,
            cover.bundleId,
            cover.output,
          ],
          { timeout: 120_000 },
        );
        expect(result.stdout).toContain("global-navigation-ok");
      } finally {
        await cover.close();
      }
    } finally {
      await target.close();
    }
  },
  240_000,
);
