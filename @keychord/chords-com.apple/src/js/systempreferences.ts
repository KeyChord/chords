import { dlopen } from "bun:ffi";

export default function buildAppearanceHandler() {
  return function setAppearance(mode: string): void {
    if (mode !== "auto" && mode !== "dark" && mode !== "light") {
      throw new TypeError("Appearance must be auto, dark, or light");
    }

    // SkyLight applies the system preference and notifies running apps immediately.
    // Resolve all symbols before changing anything, so an unavailable API fails safely.
    const library = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", {
      SLSSetAppearanceThemeSwitchesAutomatically: { args: ["bool"], returns: "void" },
      SLSSetAppearanceThemeNotifying: { args: ["bool", "bool"], returns: "void" },
    });
    try {
      library.symbols.SLSSetAppearanceThemeSwitchesAutomatically(mode === "auto");
      if (mode !== "auto") {
        library.symbols.SLSSetAppearanceThemeNotifying(mode === "dark", true);
      }
    } finally {
      library.close();
    }
  };
}
