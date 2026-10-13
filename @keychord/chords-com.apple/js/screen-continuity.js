import { createRequire } from "node:module";
import { click } from "chord";
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
//#region ../chords-click/src/js/utils/click-sequence.ts
/** Parse x/y pairs completely before requesting any native clicks. */
function parseClickSequence(sequence, defaultClick) {
	const input = sequence.trim();
	const token = /\s*(?:(\d+(?:\.\d+)?)([lrtb])|([-0-9]))\s*/y;
	const positions = [];
	let index = 0;
	function coordinate() {
		token.lastIndex = index;
		const match = token.exec(input);
		if (!match) throw new TypeError(`Expected a click coordinate at character ${index + 1}`);
		index = token.lastIndex;
		const [, pixels, edge, digit] = match;
		const fraction = pixels === void 0;
		const value = fraction ? digit === "-" ? 0 : digit === "0" ? 1 : Number(digit) / 10 : Number(pixels);
		if (!Number.isFinite(value) || !fraction && value > Number.MAX_SAFE_INTEGER) throw new TypeError("Click offsets must be finite proportions or pixel amounts within the safe numeric range");
		return {
			edge,
			value,
			fraction
		};
	}
	while (index < input.length) {
		if (positions.length && input[index] === "/") index++;
		let click = defaultClick;
		if (input[index] === ",") {
			click = defaultClick === void 0 ? "long" : "right";
			index++;
		} else if (defaultClick !== void 0 && input[index] === ";") {
			click = "middle";
			index++;
		} else if (input[index] === ".") {
			click = defaultClick === void 0 ? void 0 : input[index + 1] === "." ? "double" : "left";
			index += click === "double" ? 2 : 1;
		}
		const position = click ? { click } : {};
		for (let axis = 0; axis < 2; axis++) {
			const amount = coordinate();
			const edge = amount.edge ?? (position.horizontal ? "t" : "l");
			if (edge === "l" || edge === "r") {
				if (position.horizontal) throw new TypeError("Each click needs one horizontal coordinate");
				position.horizontal = {
					...amount,
					edge
				};
			} else {
				if (position.vertical) throw new TypeError("Each click needs one vertical coordinate");
				position.vertical = {
					...amount,
					edge
				};
			}
		}
		positions.push(position);
	}
	if (!positions.length) throw new TypeError("Expected at least one click position");
	return positions;
}
/** AX and CGEvent both use global macOS screen points, including negative display origins. */
function resolveClickSequence(positions, bounds) {
	if (![
		bounds.x,
		bounds.y,
		bounds.width,
		bounds.height
	].every(Number.isFinite) || bounds.width < 1 || bounds.height < 1) throw new TypeError("The target window has invalid bounds");
	function coordinate(offset, size, fromEnd) {
		const distance = offset.fraction ? offset.value * size : offset.value;
		if (!Number.isFinite(distance) || distance < 0 || distance > size) throw new RangeError("Click offset is outside the target window");
		const result = fromEnd ? size - distance : distance;
		return result === size ? size - 1 : result;
	}
	return positions.map(({ horizontal, vertical, click }) => ({
		x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
		y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
		...click ? { click } : {}
	}));
}
//#endregion
//#region ../chords-click/src/js/click.ts
const CLICK_SEQUENCE_DELAY_MS = 500;
/** Send resolved screen points to one window, with an optional check before each click. */
async function clickPoints(bounds, points, validate) {
	const { x, y, width, height, windowId } = bounds;
	for (const [index, point] of points.entries()) {
		await validate?.();
		await click({
			windowId,
			x: point.x - x,
			y: point.y - y,
			expectedBounds: {
				x,
				y,
				width,
				height
			},
			...point.click === "right" || point.click === "middle" ? { button: point.click } : {},
			...point.click === "double" ? { clickCount: 2 } : {},
			...point.click === "long" ? { pressDurationMs: 500 } : {}
		});
		if (index < points.length - 1) await new Promise((resolve) => setTimeout(resolve, CLICK_SEQUENCE_DELAY_MS));
	}
}
//#endregion
//#region src/js/utils/screen-continuity-native.ts
var import__keychord_native_screenContinuity = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/screenContinuity/screenContinuity-bebebabbf25d.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] screenContinuity has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
function openScreenContinuityAddon() {
	return {
		getScreenBounds: () => import__keychord_native_screenContinuity.default.getScreenBounds(),
		async clickPoints(request) {
			const { bounds, points } = JSON.parse(request);
			await clickPoints(bounds, points, () => import__keychord_native_screenContinuity.default.validateScreenBounds(JSON.stringify(bounds)));
		}
	};
}
//#endregion
//#region src/js/screen-continuity.ts
let addon;
function buildScreenContinuityHandler() {
	let pending = Promise.resolve();
	return function click(sequence) {
		let positions;
		try {
			positions = parseClickSequence(sequence);
		} catch (error) {
			return Promise.reject(error);
		}
		const action = pending.then(async () => {
			addon ??= openScreenContinuityAddon();
			const bounds = JSON.parse(await addon.getScreenBounds());
			const points = resolveClickSequence(positions, bounds);
			await addon.clickPoints(JSON.stringify({
				bounds,
				points
			}));
		});
		pending = action.catch(() => {});
		return action;
	};
}
//#endregion
export { buildScreenContinuityHandler as default };
