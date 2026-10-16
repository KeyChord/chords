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
//#region src/js/menu.ts
var import__keychord_native_menu = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/menu/menu-ddcf4e9d2358.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] menu has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
async function runMenuAction(processName, action, value) {
	if (action === "BY_PATH") {
		if (!Array.isArray(value) || value.length < 1 || value.some((component) => typeof component !== "string" || component.trim().length === 0)) throw new TypeError("\"BY_PATH\" expects at least one non-empty string component");
		return import__keychord_native_menu.default.runMenuAction(processName, action, JSON.stringify(value));
	}
	if (action === "SEARCH" && (typeof value !== "string" || !value.trim())) throw new TypeError("\"search\" expects non-empty text");
	return import__keychord_native_menu.default.runMenuAction(processName, action, String(value));
}
/**
* Builds the `@input:menu` handler. `processName` optionally names an app to activate first.
* Otherwise Chord's captured focused-app bundle identifier is used, avoiding a race with Chord's
* panel temporarily becoming frontmost. Direct callers without an invocation context retain the
* frontmost-app fallback.
*/
function buildMenuHandler(processName) {
	return function menu(action, value = 0) {
		return runMenuAction(processName ?? this?.focusedAppId, action, value);
	};
}
//#endregion
export { buildMenuHandler as default, runMenuAction };
