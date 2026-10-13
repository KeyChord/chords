import { dlopen } from "bun:ffi";
//#region src/js/systempreferences.ts
function buildAppearanceHandler() {
	return function setAppearance(mode) {
		if (mode !== "auto" && mode !== "dark" && mode !== "light") throw new TypeError("Appearance must be auto, dark, or light");
		const library = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", {
			SLSSetAppearanceThemeSwitchesAutomatically: {
				args: ["bool"],
				returns: "void"
			},
			SLSSetAppearanceThemeNotifying: {
				args: ["bool", "bool"],
				returns: "void"
			}
		});
		try {
			library.symbols.SLSSetAppearanceThemeSwitchesAutomatically(mode === "auto");
			if (mode !== "auto") library.symbols.SLSSetAppearanceThemeNotifying(mode === "dark", true);
		} finally {
			library.close();
		}
	};
}
//#endregion
export { buildAppearanceHandler as default };
