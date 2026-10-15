import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region src/js/utils/window-dimensions.ts
var import__keychord_native_window = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/window/window-7a3371d10812.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] window has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
/** Signed single-digit shorthand: negative sizes add whole display extents. */
function parseWindowDimensions(action, expression) {
	if (action === "PRESET") {
		if (![
			"LEFT",
			"RIGHT",
			"TOP",
			"BOTTOM",
			"TOP_LEFT",
			"TOP_RIGHT",
			"BOTTOM_LEFT",
			"BOTTOM_RIGHT",
			"HORIZONTAL",
			"VERTICAL",
			"CENTER",
			"FILL"
		].includes(expression)) throw new TypeError("Unknown window preset");
		return { preset: expression };
	}
	if (action !== "SIZE" && action !== "POSITION" && action !== "FRAME") throw new TypeError("Unknown window action");
	if (typeof expression !== "string") throw new TypeError("Expected window dimensions");
	let input = expression.trim();
	const right = action === "POSITION" && input.startsWith("r");
	if (right) input = input.slice(1);
	const heightOnly = action !== "FRAME" && input.startsWith("h");
	if (heightOnly) input = input.slice(1);
	if (right && heightOnly) throw new TypeError("Right-edge positioning needs a horizontal offset");
	const dimensions = [];
	function dimension(token, unit) {
		const kind = action === "FRAME" ? dimensions.length < 2 ? "SIZE" : "POSITION" : action;
		const value = Number(token);
		if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || kind === "SIZE" && (action === "FRAME" ? value < 0 : value <= 0) || unit === "divisor" && (!value || !Number.isFinite(1 / value))) throw new TypeError("Window dimensions must be finite; sizes must be positive");
		return {
			value,
			unit
		};
	}
	if (input.includes("x")) {
		if (action === "FRAME") throw new TypeError("Combined window bounds use four shorthand dimensions");
		const absolute = /^(-?(?:\d+(?:\.\d+)?|\.\d+))x(?:(-?(?:\d+(?:\.\d+)?|\.\d+))x?)?$/.exec(input);
		if (!absolute) throw new TypeError("Expected pixel dimensions such as 200x or 200x200");
		dimensions.push(dimension(absolute[1], "pixels"));
		if (absolute[2] !== void 0) dimensions.push(dimension(absolute[2], "pixels"));
	} else {
		const token = /\s*(-?[0-9])\s*/y;
		let index = 0;
		while (index < input.length) {
			token.lastIndex = index;
			const match = token.exec(input);
			if (!match || dimensions.length === (action === "FRAME" ? 4 : 2)) throw new TypeError("Unexpected window dimension count or syntax");
			index = token.lastIndex;
			const amount = Number(match[1]);
			const kind = action === "FRAME" ? dimensions.length < 2 ? "SIZE" : "POSITION" : action;
			if (Object.is(amount, -0)) throw new TypeError("Negative zero is not a window dimension");
			const unit = action === "FRAME" && amount === 0 || kind === "SIZE" && amount < 0 || kind === "POSITION" && amount === 0 ? "fraction" : "divisor";
			dimensions.push(dimension(String(kind === "SIZE" && amount < 0 ? 1 - amount : amount), unit));
		}
	}
	if (action === "FRAME") {
		if (dimensions.length !== 4) throw new TypeError("Expected width, height, left, and top");
		return {
			...dimensions[0].value === 0 ? {} : { width: dimensions[0] },
			...dimensions[1].value === 0 ? {} : { height: dimensions[1] },
			left: dimensions[2],
			top: dimensions[3]
		};
	}
	if (!dimensions.length || heightOnly && dimensions.length !== 1) throw new TypeError("Expected a dimension; h accepts only a height");
	return {
		...heightOnly ? { height: dimensions[0] } : {
			width: dimensions[0],
			...dimensions[1] ? { height: dimensions[1] } : {}
		},
		...right ? { right: true } : {}
	};
}
//#endregion
//#region src/js/window.ts
function buildWindowHandler() {
	let pending = Promise.resolve();
	return function window(action, expression) {
		let request;
		try {
			const axis = /^(?:\/)?(?:ws([wh])|wp([xy]))/.exec(this?.input ?? "");
			if (axis && (action === "SIZE" || action === "POSITION")) {
				const { height: value } = parseWindowDimensions(action, `h${expression}`);
				request = JSON.stringify(axis[1] === "w" || axis[2] === "x" ? { width: value } : { height: value });
			} else request = JSON.stringify(parseWindowDimensions(action, expression));
		} catch (error) {
			if (error instanceof TypeError) error.message += ` (received ${JSON.stringify(this?.input ?? expression)})`;
			return Promise.reject(error);
		}
		const appId = this?.focusedAppId;
		const result = pending.then(() => import__keychord_native_window.default.runWindowAction(appId, action, request));
		pending = result.catch(() => {});
		return result;
	};
}
//#endregion
export { buildWindowHandler as default };
