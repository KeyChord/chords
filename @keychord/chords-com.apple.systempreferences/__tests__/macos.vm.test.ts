import { test } from "bun:test";
import { macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-com.apple.systempreferences: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url),
  300_000,
);
