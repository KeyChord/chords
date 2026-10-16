import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { click, getAppWindows } from "chord";
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
//#region src/js/navigation.ts
var import__keychord_native_navigation = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/navigation/navigation-fa3c0b168dfd.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] navigation has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
function buildNavigationHandler(bundleId) {
	let pending = Promise.resolve();
	return function navigation(action, index) {
		const appId = bundleId ?? this?.focusedAppId;
		if (!appId?.trim()) return Promise.reject(/* @__PURE__ */ new TypeError("A focused application is required"));
		if (![
			"PREVIOUS",
			"NEXT",
			"CLOSE",
			"OPTION"
		].includes(action)) return Promise.reject(/* @__PURE__ */ new TypeError(`Unknown navigation action: ${action}`));
		if (action === "OPTION" && (!/^[1-9]\d*$/.test(String(index)) || !Number.isSafeInteger(Number(index)))) return Promise.reject(/* @__PURE__ */ new TypeError("Option index must be a positive safe integer"));
		const request = JSON.stringify({
			action,
			...action === "OPTION" ? { index: Number(index) } : {}
		});
		const result = pending.then(async () => {
			const resolved = await import__keychord_native_navigation.default.perform(appId, request);
			if (!resolved) return;
			const target = JSON.parse(resolved);
			const windows = getAppWindows(appId).filter((window) => window.processId === target.processId && Object.keys(target.bounds).every((key) => Math.abs(window.bounds[key] - target.bounds[key]) < .5));
			if (windows.length !== 1) throw new Error("Navigation target window moved or is unavailable; retry the action");
			await click({
				windowId: windows[0].windowId,
				x: target.point.x - target.bounds.x,
				y: target.point.y - target.bounds.y,
				expectedBounds: windows[0].bounds
			});
		});
		pending = result.catch(() => void 0);
		return result;
	};
}
//#endregion
export { buildNavigationHandler as default };
