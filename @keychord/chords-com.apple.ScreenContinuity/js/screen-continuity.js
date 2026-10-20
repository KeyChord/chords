import { createRequire } from "node:module";
import { click, mouse } from "chord";
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
//#region ../chords-click/src/js/utils/click-sequence.ts
/** Parse x/y pairs completely before requesting any native clicks. */
function parseClickSequence(sequence, defaultClick, radix = 10) {
	const input = sequence.trim();
	const token = radix === 36 ? /\s*(?:=(\d+(?:\.\d+)?)([lrtb])|([0-9a-z])(?:\/([0-9a-z]))?)\s*/y : /\s*(?:(\d+(?:\.\d+)?)([lrtb])|([-0-9])(?:\/([0-9]))?)\s*/y;
	const positions = [];
	let index = 0;
	let activeDrag;
	function coordinate() {
		token.lastIndex = index;
		const match = token.exec(input);
		if (!match) throw new TypeError(`Expected a click coordinate at character ${index + 1}`);
		index = token.lastIndex;
		const [, pixels, edge, digit, tenth] = match;
		const fraction = pixels === void 0;
		const tenths = digit === "-" ? 0 : digit === "0" ? 10 : Number(digit);
		const value = fraction ? radix === 36 ? (parseInt(digit, 36) + parseInt(tenth ?? "0", 36) / 36) / 35 : (tenths * 10 + Number(tenth ?? 0)) / 100 : Number(pixels);
		if (!Number.isFinite(value) || !fraction && value > Number.MAX_SAFE_INTEGER) throw new TypeError("Click offsets must be finite proportions or pixel amounts within the safe numeric range");
		return {
			edge,
			value,
			fraction
		};
	}
	while (index < input.length) {
		if (input[index] === "-" && index === input.length - 1 && positions.length) {
			const last = positions.at(-1);
			if (last.click === "DOUBLE") throw new TypeError("A double-click cannot be held");
			last.hold = true;
			if (last.click !== "MOVE" && !last.click?.endsWith("DRAG")) last.click = last.click === "RIGHT" ? "RIGHT_DRAG" : last.click === "MIDDLE" ? "MIDDLE_DRAG" : "DRAG";
			index++;
			break;
		}
		let click = activeDrag ?? defaultClick;
		if (input[index] === ",") {
			click = defaultClick === void 0 ? "LONG" : "RIGHT";
			activeDrag = void 0;
			index++;
		} else if (defaultClick !== void 0 && input[index] === ";") {
			click = "MIDDLE";
			activeDrag = void 0;
			index++;
		} else if (input[index] === ".") {
			index++;
			if (input[index] === "=") {
				click = "MOVE";
				index++;
			} else if (input[index] === "-") {
				click = "DRAG";
				index++;
			} else if (input[index] === ";" || input[index] === ",") {
				click = input[index++] === ";" ? "MIDDLE" : "RIGHT";
				if (input[index] === "-") {
					click = click === "MIDDLE" ? "MIDDLE_DRAG" : "RIGHT_DRAG";
					index++;
				}
			} else if (defaultClick !== void 0 && input[index] === ".") {
				click = "DOUBLE";
				index++;
			} else click = defaultClick === void 0 ? void 0 : "LEFT";
			if (click?.endsWith("DRAG")) activeDrag = click;
			else if (click !== "MOVE") activeDrag = void 0;
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
function resolveClickSequence(positions, bounds, clampEdges = true) {
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
		return clampEdges && result === size ? size - 1 : result;
	}
	return positions.map(({ horizontal, vertical, click, hold }) => ({
		x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
		y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
		...click ? { click } : {},
		...hold ? { hold } : {}
	}));
}
//#endregion
//#region ../chords-click/src/js/click.ts
const CLICK_SEQUENCE_DELAY_MS = 500;
/** Send resolved screen points to one window, with an optional check before each click. */
async function clickPoints(bounds, points, validate) {
	const { x, y, width, height, windowId } = bounds;
	let held;
	let keepHeld = false;
	let usedMouse = false;
	try {
		for (const [index, point] of points.entries()) {
			await validate?.();
			const target = windowId === void 0 ? {
				x: point.x,
				y: point.y
			} : {
				windowId,
				x: point.x - x,
				y: point.y - y,
				expectedBounds: {
					x,
					y,
					width,
					height
				}
			};
			const drag = point.click?.endsWith("DRAG");
			if (drag || point.click === "MOVE") {
				usedMouse = true;
				const button = point.click === "RIGHT_DRAG" ? "right" : point.click === "MIDDLE_DRAG" ? "middle" : "left";
				if (drag && held !== button) {
					await mouse({
						...target,
						action: "down",
						button
					});
					held = button;
				} else await mouse({
					...target,
					action: "move"
				});
			} else {
				if (usedMouse) {
					await mouse({ action: "up" });
					held = void 0;
				}
				const options = {
					...target,
					moveCursor: true,
					...point.click === "RIGHT" || point.click === "MIDDLE" ? { button: point.click === "RIGHT" ? "right" : "middle" } : {},
					...point.click === "DOUBLE" ? { clickCount: 2 } : {},
					...point.click === "LONG" ? { pressDurationMs: 500 } : {}
				};
				if (windowId === void 0) {
					const { moveCursor: _, ...globalOptions } = options;
					await mouse({
						...globalOptions,
						action: "click"
					});
				} else await click({
					...options,
					windowId
				});
			}
			keepHeld = !!point.hold;
			if (index < points.length - 1) await new Promise((resolve) => setTimeout(resolve, CLICK_SEQUENCE_DELAY_MS));
		}
	} finally {
		if (usedMouse && !keepHeld) await mouse({ action: "up" });
	}
}
//#endregion
//#region src/js/utils/screen-continuity-points.ts
var import__keychord_native_screenContinuity = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	const nativeRequire = createRequire(import.meta.url);
	const nativeFiles = { "darwin-arm64": new URL("native/aarch64-apple-darwin/screenContinuity/screenContinuity-4485a190d67c.node", import.meta.url).href };
	const nativeTarget = process.platform + "-" + process.arch;
	const nativeFile = nativeFiles[nativeTarget];
	if (!nativeFile) throw new Error("[chord-native] screenContinuity has no addon for " + nativeTarget);
	module.exports = nativeRequire(fileURLToPath(nativeFile));
})))(), 1);
/** Keep tap targets just inside Mirroring's display edges. */
function clampDevicePoints(points, bounds) {
	const { x, y, width, height } = bounds;
	const inset = Math.min(2, width / 2, height / 2);
	return points.map((point) => ({
		...point,
		x: x + Math.max(inset, Math.min(width - inset, point.x - x)),
		y: y + Math.max(inset, Math.min(height - inset, point.y - y))
	}));
}
//#endregion
//#region src/js/utils/screen-continuity-native.ts
function openScreenContinuityAddon() {
	return {
		getScreenBounds: () => import__keychord_native_screenContinuity.default.getScreenBounds(),
		async clickPoints(request) {
			const { bounds, points, hover } = JSON.parse(request);
			if (hover) await mouse({ action: "up" });
			await clickPoints({
				...bounds.windowBounds,
				windowId: bounds.windowId
			}, hover ? points.map(({ x, y }) => ({
				x,
				y,
				click: "MOVE"
			})) : clampDevicePoints(points, bounds), () => import__keychord_native_screenContinuity.default.validateScreenBounds(JSON.stringify(bounds)));
		}
	};
}
//#endregion
//#region src/js/screen-continuity.ts
let addon;
let pending = Promise.resolve();
function buildScreenContinuityHandler(mode = "TAP") {
	return function click(sequence) {
		let positions;
		try {
			positions = mode === "HOVER" ? parseClickSequence(sequence, "MOVE", 36) : sequence.startsWith("-") ? parseClickSequence(sequence.slice(1), "DRAG", 36) : parseClickSequence(sequence, void 0, 36);
			if (mode === "HOVER" && positions.some((point) => point.click !== "MOVE" || point.hold)) throw new TypeError("Hover accepts coordinate pairs without click, drag or hold modifiers");
		} catch (error) {
			return Promise.reject(error);
		}
		const action = pending.then(async () => {
			addon ??= openScreenContinuityAddon();
			const bounds = JSON.parse(await addon.getScreenBounds());
			const points = resolveClickSequence(positions, bounds, mode !== "HOVER");
			await addon.clickPoints(JSON.stringify({
				bounds,
				points,
				...mode === "HOVER" ? { hover: true } : {}
			}));
		});
		pending = action.catch(() => {});
		return action;
	};
}
//#endregion
export { buildScreenContinuityHandler as default };
