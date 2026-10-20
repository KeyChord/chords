import { test } from "bun:test";
import { macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-com.apple.ScreenContinuity: production package loads in the macOS VM",
  () =>
    testMacOSPackage(import.meta.url, [
      { product: "KeychordChordsComAppleNativeScreenContinuity", name: "screenContinuity" },
    ]),
  300_000,
);
