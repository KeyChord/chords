import { test } from "bun:test";
import { macOSUITestsEnabled, runChordScript, testMacOSPackage } from "@keychord/chordtest";
import { expect } from "bun:test";

test.skipIf(!macOSUITestsEnabled)(
  "@keychord/chords-web: production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url, [{ product: "KeychordChordsWebNativeWeb", name: "web" }]),
  300_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "Swift web addon rejects invalid input before browser interaction",
  async () => {
    const result = await runChordScript(new URL("./web.integration.ts", import.meta.url));
    expect(result.stdout).toContain("web-native-validation-ok");
  },
);
