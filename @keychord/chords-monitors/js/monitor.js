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
//#region src/js/monitor.ts
var import__keychord_native_monitor = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/monitor/monitor-e338ea53ba3d.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] monitor has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
/** Resolution changes require a complete pair of absolute integer dimensions. */
function parseMonitorResolution(expression) {
	const match = typeof expression === "string" && /^([1-9]\d*)x([1-9]\d*)$/.exec(expression.trim());
	if (!match) throw new TypeError("Expected an absolute monitor resolution such as 1920x1080");
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) throw new TypeError("Monitor resolution exceeds the safe integer range");
	return {
		width,
		height
	};
}
function buildMonitorHandler() {
	let pending = Promise.resolve();
	return function monitor(target, action = "FOCUS") {
		let operation;
		try {
			if (action === "SIZE") {
				const { width, height } = parseMonitorResolution(target);
				operation = () => import__keychord_native_monitor.default.setMonitorResolution(width, height);
			} else if (action === "FOCUS") {
				if (typeof target !== "string" || !/^(?:[1-9]\d*|PREVIOUS|NEXT|LEFT|RIGHT|UP|DOWN)$/.test(target) || /^\d/.test(target) && !Number.isSafeInteger(Number(target))) throw new TypeError("Expected a positive monitor number or direction");
				operation = () => import__keychord_native_monitor.default.focusMonitor(target);
			} else throw new TypeError("Unknown monitor action");
		} catch (error) {
			return Promise.reject(error);
		}
		const result = pending.then(operation);
		pending = result.catch(() => {});
		return result;
	};
}
//#endregion
export { buildMonitorHandler as default, parseMonitorResolution };
