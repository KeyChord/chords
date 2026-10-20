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
//#endregion
//#region src/js/selection.ts
/** Recompute from the edited buffer so Backspace also restores the previous selection. */
function parseMenuBarSelection(sequence) {
	const match = /^([[\]]?)(-?)(0|[1-9][0-9]*)([lr]?)([[\]]*)([.,]?)$/.exec(sequence);
	if (!match) return;
	const [, prefix, fromEnd, digits, side, steps, click] = match;
	const scope = prefix === "[" || !prefix && !fromEnd && digits === "0" && !side && !steps ? "MENU" : "TRAY";
	const count = Number(side ? digits : digits.at(-1));
	const fromRight = side === "r" || !side && !!fromEnd;
	if (!Number.isSafeInteger(count) || count === 0 && (fromRight || scope === "TRAY")) return;
	return {
		scope,
		index: fromRight ? -count : scope === "TRAY" ? count - 1 : count,
		steps,
		...click ? { clickType: click === "." ? "LEFT" : "RIGHT" } : {}
	};
}
function buildSelectionHandler() {
	return async function select(trigger, sequence) {
		const event = this?.event;
		if (trigger === "INPUT" && event) return;
		if (trigger === "KEYDOWN" && (event?.type !== "keydown" || event.repeat)) return;
		const selection = parseMenuBarSelection(sequence);
		if (!selection) {
			if (/[.,]$/.test(sequence)) throw new RangeError("Select a valid menu bar index, or use a full index followed by l/r");
			return;
		}
		if (selection.clickType) {
			if (trigger === "KEYDOWN" && event?.key !== sequence.at(-1)) return;
		} else if (trigger !== "KEYDOWN") return;
		await runMenuBarAction(selection, this?.focusedAppId);
	};
}
//#endregion
export { buildSelectionHandler as default, parseMenuBarSelection };
