import { test } from "bun:test";
import { macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";

// The shared VM runs macOS 26, which has no Siri AI Spotlight panel, so this only checks that
// the production package and its addon load. The launcher itself was mapped and tested on
// macOS 27; see readme.md.
test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-com.apple.Spotlight: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url),
  300_000,
);
