import assert from "node:assert/strict";
import { dlopen } from "bun:ffi";
import { requireMacOSVM, runCommand, waitFor } from "@keychord/chordtest";
import buildAppearanceHandler from "../js/systempreferences.js";

requireMacOSVM();
const definition = Bun.TOML.parse(
  await Bun.file(
    new URL("../chords/com/apple/systempreferences/macos.toml", import.meta.url),
  ).text(),
) as { chords: Record<string, { shell?: string; "@input:appearance"?: string[] }> };
const library = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", {
  SLSGetAppearanceThemeSwitchesAutomatically: { args: [], returns: "bool" },
  SLSGetAppearanceThemeLegacy: { args: [], returns: "bool" },
});
const originalAuto = library.symbols.SLSGetAppearanceThemeSwitchesAutomatically();
const originalDark = library.symbols.SLSGetAppearanceThemeLegacy();
const appearance = buildAppearanceHandler();
try {
  assert.throws(() => appearance("invalid"), /Appearance must be/);
  assert.equal(library.symbols.SLSGetAppearanceThemeSwitchesAutomatically(), originalAuto);
  assert.equal(library.symbols.SLSGetAppearanceThemeLegacy(), originalDark);
  // Alternate explicit and automatic modes to catch a sticky Auto preference.
  for (const chord of ["apd", "apa", "apl", "apa", "apd"]) {
    const mode = definition.chords[chord]["@input:appearance"]![0];
    appearance(mode);
    await waitFor(async () => {
      if (library.symbols.SLSGetAppearanceThemeSwitchesAutomatically() !== (mode === "auto"))
        return undefined;
      if (mode !== "auto" && library.symbols.SLSGetAppearanceThemeLegacy() !== (mode === "dark"))
        return undefined;
      return true;
    });
    // Read through the preferences service as an independent persistence check.
    const persisted = await runCommand(["defaults", "export", "NSGlobalDomain", "-"]);
    // macOS represents disabled automatic switching by removing this preference.
    const automatic = /<key>AppleInterfaceStyleSwitchesAutomatically<\/key>\s*<true\s*\/>/.test(
      persisted.stdout,
    );
    assert.equal(automatic, mode === "auto");
    if (mode !== "auto") {
      const dark = /<key>AppleInterfaceStyle<\/key>\s*<string>Dark<\/string>/.test(
        persisted.stdout,
      );
      assert.equal(dark, mode === "dark");
    }
  }
} finally {
  appearance(originalDark ? "dark" : "light");
  if (originalAuto) appearance("auto");
  library.close();
}
console.log("systempreferences-appearance-ok");
