import { expect, test } from "bun:test";
import { macOSUITestsEnabled, runChordScript } from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "System Preferences appearance chords apply and persist Light, Dark, and Auto",
  async () => {
    const result = await runChordScript(
      new URL("./systempreferences.integration.ts", import.meta.url),
    );
    expect(result.stdout).toContain("systempreferences-appearance-ok");
  },
  60_000,
);
