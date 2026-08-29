import { resolveNativeModulePath } from "chord";
//#region src/js/menu.ts
/**
* macOS menu bar handler: a thin Node-API binding over the Swift implementation in
* `src/swift/menu/menu.swift`, which `@keychord/config` compiles to
* `target/<triple>/menu/menu.node`. Chord runs handlers on Bun, so the addon is
* opened in-process — no helper process, no `osascript` round trip.
*
* The addon is located through Chord's `chord` module (`resolveNativeModulePath`), which knows the
* package layout (including vendored copies), so nothing here depends on where the package is
* installed.
*/
let addon;
function openMenuAddon() {
	const module = { exports: {} };
	process.dlopen(module, resolveNativeModulePath(import.meta, "menu"));
	return module.exports;
}
function runMenuAction(processName, action, value) {
	addon ??= openMenuAddon();
	addon.runMenuAction(processName, action, value);
}
/**
* Builds the `emit:menu` handler. `processName` optionally names an app to activate first.
* Otherwise Chord's captured focused-app bundle identifier is used, avoiding a race with Chord's
* panel temporarily becoming frontmost. Direct callers without an invocation context retain the
* frontmost-app fallback.
*/
function buildMenuHandler(processName) {
	return function menu(action, value = 0) {
		runMenuAction(processName ?? this?.focusedAppId, action, String(value));
	};
}
//#endregion
export { buildMenuHandler as default, runMenuAction };
