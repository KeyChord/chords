//#region src/js/tray.ts
let addon;
function openTrayAddon() {
	const module = { exports: {} };
	process.dlopen(module, import.meta.chord.resolveNative("tray"));
	return module.exports;
}
async function runTrayAction(...args) {
	const [type, value, action] = args;
	if (type === "ITEM" && !Number.isSafeInteger(value)) throw new TypeError("tray index must be a safe integer");
	addon ??= openTrayAddon();
	return addon.runTrayAction(type, value === void 0 ? "" : String(value), action ?? (type === "ITEM" ? "left" : ""));
}
/**
* Builds the typed `@input:tray` handler. ITEM indexes count from the first menu-bar extra to the
* right of the application menus; negative indexes count from the right edge. CONTROL_CENTER
* opens the panel and optionally expands a section or operates one of its controls.
*/
function buildHandler() {
	return runTrayAction;
}
//#endregion
export { buildHandler as default, runTrayAction };
