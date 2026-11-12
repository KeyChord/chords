import { n as __toESM } from "./rolldown-runtime-DXIUcv95.js";
import { tap } from "chord";
//#region src/js/utils/native.ts
let addon;
const native = async () => (await (addon ??= import("./_keychord-native_spotlight-CB_NFyxs.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1)))).default;
/** Whether this Mac has the Spotlight panel the launcher drives (macOS 27's Siri AI app). */
async function isSpotlightSupported() {
	return JSON.parse(await (await native()).isSupported());
}
async function isSpotlightPanelOpen() {
	return JSON.parse(await (await native()).isPanelOpen());
}
/** Waits for the panel and leaves any scoped view; false if it never opened. */
async function prepareSpotlight(remainingMs) {
	return JSON.parse(await (await native()).prepare(remainingMs));
}
/**
* Runs `query` from an empty search and waits until Spotlight selects a result for it. "closed"
* means the panel went away first.
*/
async function searchSpotlight(query, remainingMs) {
	return await (await native()).search(query, remainingMs);
}
/**
* Re-reads the panel: still showing a result selected for `query`. If so, raises it, so it has
* the keyboard even after another app was activated since it opened.
*/
async function focusSpotlight(query) {
	return JSON.parse(await (await native()).focus(query));
}
/** Resolves true once the panel closes, which Spotlight does after opening the result. */
async function awaitSpotlightClosed(remainingMs) {
	return JSON.parse(await (await native()).awaitClosed(remainingMs));
}
//#endregion
//#region src/js/spotlight.ts
/** macOS 27 shows Spotlight in the Siri AI app, which opens it for this URL. */
const PANEL_BUNDLE_ID = "com.apple.campo";
const PANEL_URL = "spotlight://apps";
/**
* Opens Spotlight's top result for a query, as typing it into Spotlight and pressing Return does.
* `query` "" just opens Spotlight.
*/
function buildSpotlightHandler(timeoutMs = 5e3) {
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError("Spotlight's timeout must be a positive integer in milliseconds");
	async function open() {
		const child = Bun.spawn([
			"/usr/bin/open",
			"-b",
			PANEL_BUNDLE_ID,
			PANEL_URL
		], {
			stdout: "ignore",
			stderr: "pipe",
			timeout: timeoutMs
		});
		const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
		if (exitCode !== 0) throw new Error(`Unable to open Spotlight (exit ${exitCode}): ${stderr.trim()}`);
	}
	async function run(query) {
		if (!await isSpotlightSupported()) throw new Error("The Spotlight launcher needs macOS 27 or later. To search with `/` on this Mac, install @keychord/chords-raycast.");
		let search = "closed";
		for (let attempt = 0; search === "closed" && attempt < 2; attempt++) {
			if (!await isSpotlightPanelOpen()) await open();
			if (!await prepareSpotlight(timeoutMs)) throw new Error(`Spotlight's search did not open within ${timeoutMs}ms`);
			if (!query) return;
			search = await searchSpotlight(query, timeoutMs);
		}
		if (search === "closed") throw new Error("Spotlight closed its search before it finished");
		if (search === "nothing") throw new Error(`Spotlight found nothing to open for “${query}”`);
		if (search === "timeout") throw new Error(`Spotlight found nothing for “${query}” within ${timeoutMs}ms`);
		if (!await focusSpotlight(query)) throw new Error(`Spotlight's results for “${query}” changed before opening one`);
		tap("enter");
		if (!await awaitSpotlightClosed(timeoutMs)) throw new Error(`Spotlight did not open its result for “${query}” within ${timeoutMs}ms`);
	}
	let pending;
	return function spotlight(query = "") {
		if (typeof query !== "string") return Promise.reject(/* @__PURE__ */ new TypeError("Spotlight's query must be a string"));
		if (pending?.query === query) return pending.action;
		const previous = pending?.action;
		const action = (previous ? previous.catch(() => {}).then(() => run(query)) : run(query)).finally(() => {
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
export { buildSpotlightHandler as default };
