import { test } from "bun:test";
import { macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-com.apple.Safari: production package loads in the macOS VM",
  () =>
    testMacOSPackage(import.meta.url, [
      { product: "KeychordChordsComAppleNativeSafari", name: "safari" },
    ]),
  300_000,
);
