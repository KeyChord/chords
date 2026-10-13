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
//#region src/js/utils/native.ts
var import__keychord_native_raycast = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/raycast/raycast-39efc959c767.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] raycast has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
async function readRaycastFocus() {
	return JSON.parse(await import__keychord_native_raycast.default.readFocus());
}
async function typeRaycastSearch(query) {
	await import__keychord_native_raycast.default.typeSearch(query);
}
async function submitRaycastSearch(query) {
	await import__keychord_native_raycast.default.submitSearch(query);
}
//#endregion
//#region src/js/raycast.ts
const bundleId = "com.raycast.macos";
const pollIntervalMs = 50;
const searchSettleMs = 200;
function isRaycastInputFocused(focus) {
	return focus.bundleId === bundleId && focus.focused === true && (focus.role === "AXTextField" || focus.role === "AXSearchField") && /^Search for apps (?:and|or) commands(?:[.\u2026]|$)/i.test(focus.placeholder || focus.description || "");
}
/** Open Raycast, replace its search text, and activate the first result. */
function buildRaycastHandler(timeoutMs = 5e3) {
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("Raycast's focus timeout must be a positive integer in milliseconds");
	let pending;
	async function openAndSearch(query) {
		const deadline = performance.now() + timeoutMs;
		const child = Bun.spawn([
			"/usr/bin/open",
			"-b",
			bundleId
		], {
			stdout: "ignore",
			stderr: "pipe",
			timeout: timeoutMs
		});
		const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
		if (exitCode !== 0) throw new Error(`Unable to open Raycast (exit ${exitCode}): ${stderr.trim()}`);
		while (performance.now() < deadline) {
			if (isRaycastInputFocused(await readRaycastFocus())) {
				if (!query) return;
				await typeRaycastSearch(query);
				let searchReadyAt;
				while (performance.now() < deadline) {
					const focus = await readRaycastFocus();
					if (!isRaycastInputFocused(focus)) throw new Error("Raycast's search input lost focus before selecting a result");
					if (focus.value === query) {
						searchReadyAt ??= performance.now() + searchSettleMs;
						if (performance.now() >= searchReadyAt) {
							await submitRaycastSearch(query);
							return;
						}
					} else searchReadyAt = void 0;
					await pause(deadline);
				}
				throw new Error(`Raycast's search did not become ready within ${timeoutMs}ms`);
			}
			await pause(deadline);
		}
		throw new Error(`Raycast's search input did not receive focus within ${timeoutMs}ms`);
	}
	async function pause(deadline) {
		const remaining = deadline - performance.now();
		if (remaining > 0) await Bun.sleep(Math.min(pollIntervalMs, remaining));
	}
	return function raycast(query = "") {
		if (typeof query !== "string") return Promise.reject(/* @__PURE__ */ new TypeError("Raycast's query must be a string"));
		if (pending?.query === query) return pending.action;
		const previous = pending?.action;
		const action = (previous ? previous.catch(() => {}).then(() => openAndSearch(query)) : openAndSearch(query)).finally(() => {
			if (pending?.action === action) pending = void 0;
		});
		pending = {
			query,
			action
		};
		return action;
	};
}
//#endregion
export { buildRaycastHandler as default, isRaycastInputFocused };
