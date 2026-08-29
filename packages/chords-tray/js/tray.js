import { resolveNativeModulePath } from "chord";
//#region src/js/tray.ts
/**
* Thin Node-API binding over the native menu-bar-extra scanner in `src/swift/tray/tray.swift`.
* `@keychord/config` compiles the Swift source to
* `target/<triple>/tray/tray.node`.
*/
let addon;
function openTrayAddon() {
	const module = { exports: {} };
	process.dlopen(module, resolveNativeModulePath(import.meta, "tray"));
	return module.exports;
}
function runTrayAction(trayIndex, clickType = "left") {
	addon ??= openTrayAddon();
	addon.runTrayAction(trayIndex, clickType);
}
/**
* Builds the tray handler. Positive indexes count from the first menu-bar extra to the right of
* the application menus; negative indexes count from the right edge.
*/
function buildHandler() {
	return runTrayAction;
}
//#endregion
export { buildHandler as default, runTrayAction };
