import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region src/js/tray.ts
var import__keychord_native_menu = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/menu/menu-ddcf4e9d2358.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] menu has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
async function runMenuBarAction(selection, focusedAppId) {
	if (!Number.isSafeInteger(selection.index)) throw new TypeError("menu bar index must be a safe integer");
	return import__keychord_native_menu.default.runMenuBarAction(focusedAppId, selection.scope, String(selection.index), selection.steps, selection.clickType ?? "");
}
async function runTrayAction(...args) {
	const [type, value, action] = args;
	if ((type === "ITEM" || type === "HOVER") && !Number.isSafeInteger(value)) throw new TypeError("tray index must be a safe integer");
	return import__keychord_native_menu.default.runTrayAction(type, value === void 0 ? "" : String(value), action ?? (type === "ITEM" ? "LEFT" : ""));
}
/**
* Builds the typed `@input:tray` handler. ITEM indexes count from the first menu-bar extra to the
* right of the application menus; negative indexes count from the right edge. HOVER moves the
* pointer to the indexed item without activating it. CONTROL_CENTER
* opens the panel and optionally expands a section or operates one of its controls.
* BATTERY and DATE_TIME activate their named menu-bar extras. WIFI opens its menu (or its
* Control Center section when the icon is hidden); WIFI > TOGGLE switches Wi-Fi on/off.
*/
function buildHandler() {
	return runTrayAction;
}
//#endregion
export { buildHandler as default, runMenuBarAction, runTrayAction };
