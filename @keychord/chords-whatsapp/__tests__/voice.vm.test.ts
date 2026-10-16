import { expect, test } from "bun:test";
import { launchMacOSFixture, macOSUITestsEnabled } from "@keychord/chordtest";
import { runCommand } from "@keychord/chordtest/macos";

test.skipIf(!macOSUITestsEnabled)(
  "WhatsApp voice controls and chat positions beyond 9 work through the production host",
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
            "VOICE",
          ],
          { timeout: 180_000 },
        );
        expect(result.stdout).toContain("whatsapp-voice-chat-ok");
      } finally {
        await cover.close();
      }
    } finally {
      await target.close();
    }
  },
  240_000,
);
