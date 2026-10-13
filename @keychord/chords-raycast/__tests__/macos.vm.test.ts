import { expect, test } from "bun:test";
import { macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";
import { runCommand } from "@keychord/chordtest/macos";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-raycast: production package loads in the macOS VM",
  async () => {
    // Exercise the shipped, content-addressed production addon used by the JS
    // bundle; rebuilding a separate debug image does not validate that artifact.
    await testMacOSPackage(import.meta.url, []);
    const result = await runCommand(
      [
        process.env.CHORD_NATIVE_TEST_HOST!,
        "bun",
        Bun.fileURLToPath(new URL("./raycast.integration.ts", import.meta.url)),
      ],
      { timeout: 120_000 },
    );
    expect(result.stdout).toContain("raycast-atomic-search-and-activation-ok");
  },
  300_000,
);
