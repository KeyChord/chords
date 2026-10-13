import { test } from "bun:test";
import { macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-tray: production package loads in the macOS VM",
  () =>
    testMacOSPackage(import.meta.url, [{ product: "KeychordChordsTrayNativeTray", name: "tray" }]),
  300_000,
);

// Reuse the native validation and Control Center scenario in the isolated guest.
if (macOSUITestsEnabled) await import("./tray-native.test");
