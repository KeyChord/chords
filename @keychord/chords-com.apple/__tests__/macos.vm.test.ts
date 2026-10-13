import { test } from "bun:test";
import { macOSUITestsEnabled, runChordScript, testMacOSPackage } from "@keychord/chordtest";
import { expect } from "bun:test";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-com.apple: production package loads in the macOS VM",
  () =>
    testMacOSPackage(import.meta.url, [
      { product: "KeychordChordsComAppleNativeSafari", name: "safari" },
      { product: "KeychordChordsComAppleNativeScreenContinuity", name: "screenContinuity" },
    ]),
  300_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "real Apple addons report unavailable Mirroring and invalid JavaScript",
  async () => {
    const result = await runChordScript(new URL("./apple.integration.ts", import.meta.url));
    expect(result.stdout).toContain("apple-native-validation-ok");
  },
);
