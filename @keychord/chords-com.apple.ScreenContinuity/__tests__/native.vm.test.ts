import { expect, test } from "bun:test";
import { macOSUITestsEnabled, runChordScript } from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "real Apple addons report unavailable Mirroring and invalid JavaScript",
  async () => {
    const result = await runChordScript(new URL("./apple.integration.ts", import.meta.url));
    expect(result.stdout).toContain("apple-native-validation-ok");
  },
);
