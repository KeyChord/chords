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
//#region ../../node_modules/.pnpm/p-wait-for@6.0.0/node_modules/p-wait-for/index.js
const resolveValue = Symbol("resolveValue");
const sleep = (ms, signal) => new Promise((resolve, reject) => {
	if (signal?.aborted) {
		reject(signal.reason);
		return;
	}
	const timeout = setTimeout(resolve, ms);
	if (signal) signal.addEventListener("abort", () => {
		clearTimeout(timeout);
		reject(signal.reason);
	}, { once: true });
});
const validateOptions = (interval, timeout) => {
	if (typeof interval !== "number" || !Number.isFinite(interval) || interval < 0) throw new TypeError("Expected interval to be a finite non-negative number");
	if (typeof timeout === "object" && timeout !== null) {
		if (typeof timeout.milliseconds !== "number" || Number.isNaN(timeout.milliseconds) || timeout.milliseconds < 0) throw new TypeError("Expected timeout.milliseconds to be a finite non-negative number");
	} else if (typeof timeout === "number" && (Number.isNaN(timeout) || timeout < 0)) throw new TypeError("Expected timeout to be a finite non-negative number");
};
const createTimeoutError = (timeout) => {
	if (timeout.message instanceof Error) return timeout.message;
	return new TimeoutError(timeout.message ?? `Promise timed out after ${timeout.milliseconds} milliseconds`);
};
const handleFallback = (timeout) => {
	if (timeout.fallback) return timeout.fallback();
	throw createTimeoutError(timeout);
};
const handleAbortError = (timeoutSignal, timeout, signal) => {
	if (timeoutSignal?.aborted) {
		if (typeof timeout === "object") return handleFallback(timeout);
		throw new TimeoutError();
	}
	throw signal.reason;
};
async function pWaitFor(condition, options = {}) {
	const { interval = 20, timeout = Number.POSITIVE_INFINITY, before = true, signal } = options;
	validateOptions(interval, timeout);
	const timeoutMs = typeof timeout === "number" ? timeout : timeout?.milliseconds ?? Number.POSITIVE_INFINITY;
	const timeoutSignal = timeoutMs === Number.POSITIVE_INFINITY ? void 0 : AbortSignal.timeout(timeoutMs);
	const combinedSignal = timeoutSignal && signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal ?? signal;
	if (!before) await sleep(interval, combinedSignal);
	if (combinedSignal?.aborted) return handleAbortError(timeoutSignal, timeout, signal);
	while (true) try {
		const value = await condition();
		if (typeof value === "object" && value !== null && resolveValue in value) return value[resolveValue];
		if (value === true) return;
		if (value === false) {
			await sleep(interval, combinedSignal);
			continue;
		}
		throw new TypeError("Expected condition to return a boolean");
	} catch (error) {
		if (error === combinedSignal?.reason) return handleAbortError(timeoutSignal, timeout, signal);
		throw error;
	}
}
pWaitFor.resolveWith = (value) => ({ [resolveValue]: value });
var TimeoutError = class extends Error {
	constructor(message = "Promise timed out") {
		super(message);
		this.name = "TimeoutError";
	}
};
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.3/node_modules/uuid/dist-node/stringify.js
const byteToHex = [];
for (let i = 0; i < 256; ++i) byteToHex.push((i + 256).toString(16).slice(1));
function unsafeStringify(arr, offset = 0) {
	return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.3/node_modules/uuid/dist-node/rng.js
const rnds8 = /* @__PURE__ */ new Uint8Array(16);
function rng() {
	return crypto.getRandomValues(rnds8);
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.3/node_modules/uuid/dist-node/v4.js
function v4(options, buf, offset) {
	if (!buf && !options && crypto.randomUUID) return crypto.randomUUID();
	return _v4(options, buf, offset);
}
function _v4(options, buf, offset) {
	options = options || {};
	const rnds = options.random ?? options.rng?.() ?? rng();
	if (rnds.length < 16) throw new Error("Random bytes length must be >= 16");
	rnds[6] = rnds[6] & 15 | 64;
	rnds[8] = rnds[8] & 63 | 128;
	if (buf) {
		offset = offset || 0;
		if (offset < 0 || offset + 16 > buf.length) throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
		for (let i = 0; i < 16; ++i) buf[offset + i] = rnds[i];
		return buf;
	}
	return unsafeStringify(rnds);
}
//#endregion
//#region ../../node_modules/.pnpm/validator@13.15.35/node_modules/validator/lib/util/assertString.js
var require_assertString = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = assertString;
	function assertString(input) {
		if (input === void 0 || input === null) throw new TypeError("Expected a string but received a ".concat(input));
		if (input.constructor.name !== "String") throw new TypeError("Expected a string but received a ".concat(input.constructor.name));
	}
	module.exports = exports.default;
	module.exports.default = exports.default;
}));
//#endregion
//#region src/js/monitor.ts
var import_isUUID = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	exports.default = isUUID;
	var _assertString = _interopRequireDefault(require_assertString());
	function _interopRequireDefault(e) {
		return e && e.__esModule ? e : { default: e };
	}
	var uuid = {
		1: /^[0-9A-F]{8}-[0-9A-F]{4}-1[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		2: /^[0-9A-F]{8}-[0-9A-F]{4}-2[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		3: /^[0-9A-F]{8}-[0-9A-F]{4}-3[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		4: /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		5: /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		6: /^[0-9A-F]{8}-[0-9A-F]{4}-6[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		7: /^[0-9A-F]{8}-[0-9A-F]{4}-7[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		8: /^[0-9A-F]{8}-[0-9A-F]{4}-8[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		nil: /^00000000-0000-0000-0000-000000000000$/i,
		max: /^ffffffff-ffff-ffff-ffff-ffffffffffff$/i,
		loose: /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i,
		all: /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i
	};
	function isUUID(str, version) {
		(0, _assertString.default)(str);
		if (version === void 0 || version === null) version = "all";
		return version in uuid ? uuid[version].test(str) : false;
	}
	module.exports = exports.default;
	module.exports.default = exports.default;
})))(), 1);
function managedTarget(name) {
	const match = /^Chord \/m[ds] (\S+) [1-9]\d*x[1-9]\d* (\S+)$/.exec(name);
	return match && (0, import_isUUID.default)(match[1], "loose") && (0, import_isUUID.default)(match[2], "loose") ? match[1] : void 0;
}
var BetterDisplayError = class extends Error {
	missing;
	constructor(message, missing = false) {
		super(message);
		this.missing = missing;
	}
};
/** Use the app's bundled CLI when the optional Homebrew wrapper is unavailable. */
function createBetterDisplayCommand(executable, timeout = 1e4) {
	return async (args) => {
		let binary = executable ?? process.env.BETTERDISPLAY_CLI ?? Bun.which("betterdisplaycli");
		if (!binary) {
			for (const path of ["/Applications/BetterDisplay.app/Contents/MacOS/BetterDisplay", `${process.env.HOME}/Applications/BetterDisplay.app/Contents/MacOS/BetterDisplay`]) if (await Bun.file(path).exists()) {
				binary = path;
				break;
			}
		}
		if (!binary) throw new Error("Install and open BetterDisplay, then enable its CLI integration");
		const child = Bun.spawn([binary, ...args], {
			stdout: "pipe",
			stderr: "pipe",
			timeout
		});
		const [stdout, stderr, code] = await Promise.all([
			new Response(child.stdout).text(),
			new Response(child.stderr).text(),
			child.exited
		]);
		if (code !== 0) {
			const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join("; ");
			throw new BetterDisplayError(`BetterDisplay ${args[0]} failed${child.signalCode ? ` (terminated; timeout ${timeout}ms)` : ""}${detail ? `: ${detail}` : ""}`, code === 1 && detail === "Failed.");
		}
		return stdout.trim();
	};
}
function parseMonitorResolution(expression) {
	const match = typeof expression === "string" && /^([1-9]\d*)x([1-9]\d*)$/.exec(expression.trim());
	if (!match) throw new TypeError("Expected an absolute monitor resolution such as 1440x1728");
	if (match.slice(1).some((value) => !Number.isSafeInteger(Number(value)) || Number(value) > 16384)) throw new RangeError("BetterDisplay resolution dimensions must not exceed 16384");
	return `${Number(match[1])}x${Number(match[2])}`;
}
async function optional(command, args) {
	try {
		return await command(args);
	} catch (error) {
		if (error instanceof BetterDisplayError && error.missing) return void 0;
		throw error;
	}
}
async function managedScreens(command) {
	const output = await optional(command, [
		"get",
		"--type=VirtualScreen",
		"--identifiers"
	]);
	if (!output) return [];
	const entries = JSON.parse(output.startsWith("[") ? output : `[${output}]`);
	if (!Array.isArray(entries)) throw new Error("Invalid BetterDisplay virtual-screen list");
	return entries.flatMap((entry) => {
		const target = typeof entry?.name === "string" && managedTarget(entry.name);
		return target && entry.deviceType === "VirtualScreen" && /^[1-9]\d*$/.test(entry.tagID) ? [{
			tagID: entry.tagID,
			name: entry.name,
			target
		}] : [];
	});
}
async function pointerDisplay(command) {
	const physical = await optional(command, [
		"get",
		"--type=Display",
		"--displayWithMouse",
		"--identifier=UUID"
	]);
	if (physical && (0, import_isUUID.default)(physical, "loose")) return physical;
	const resolved = (await command([
		"get",
		"--type=VirtualScreen",
		"--displayWithMouse",
		"--identifier=name"
	])).split(",").map(managedTarget);
	const targets = new Set(resolved);
	if (targets.size !== 1 || targets.has(void 0)) throw new Error("Move the pointer to a physical display or a virtual screen created by /md");
	return [...targets][0];
}
function singleValue(output) {
	const values = output.split(",").map((value) => value.trim());
	return values.every((value) => value === values[0]) ? values[0] : output;
}
async function waitFor(command, args, expected) {
	let actual;
	return pWaitFor(async () => {
		actual = await optional(command, args);
		if (actual !== void 0) actual = singleValue(actual);
		return actual !== void 0 && (typeof expected === "string" ? actual === expected : expected.test(actual)) ? pWaitFor.resolveWith(actual) : false;
	}, {
		interval: 100,
		timeout: {
			milliseconds: 5e3,
			fallback: () => {
				throw new Error(`BetterDisplay did not apply ${expected} (reported ${actual ?? "unavailable"})`);
			}
		}
	});
}
const screen = (tagID) => ["--type=VirtualScreen", `--tagID=${tagID}`];
async function selectVirtualResolution(command, virtual, resolution) {
	await waitFor(command, [
		"get",
		...virtual,
		"--connected"
	], "on");
	if (await waitFor(command, [
		"get",
		...virtual,
		"--resolution"
	], /^[1-9]\d*x[1-9]\d*$/) !== resolution || singleValue(await command([
		"get",
		...virtual,
		"--hiDPI"
	])) !== "on") await command([
		"set",
		...virtual,
		`--resolution=${resolution}`,
		"--hiDPI=on"
	]);
	await waitFor(command, [
		"get",
		...virtual,
		"--resolution"
	], resolution);
	await waitFor(command, [
		"get",
		...virtual,
		"--hiDPI"
	], "on");
}
async function setResolution(command, resolution) {
	const target = await pointerDisplay(command);
	const display = ["--type=Display", `--UUID=${target}`];
	const previous = (await managedScreens(command)).filter((entry) => entry.target === target);
	const current = await command([
		"get",
		...display,
		"--resolution"
	]);
	if (resolution !== "reset" && current === resolution) return;
	const suspended = [];
	let created;
	let nativeResolution;
	try {
		for (const entry of previous) if (await command([
			"get",
			...screen(entry.tagID),
			"--mirror",
			`--targetUUID=${target}`
		]) === "on") {
			suspended.push({
				...entry,
				resolution: await command([
					"get",
					...screen(entry.tagID),
					"--resolution"
				])
			});
			await command([
				"set",
				...screen(entry.tagID),
				"--connected=off"
			]);
			await waitFor(command, [
				"get",
				...screen(entry.tagID),
				"--connected"
			], "off");
		}
		if (resolution !== "reset") {
			nativeResolution = await command([
				"get",
				...display,
				"--resolution"
			]);
			if ((await command([
				"get",
				...display,
				"--displayModeList"
			])).split("\n").some((line) => line.match(/^\d+ - (\d+x\d+)\b/)?.[1] === resolution)) {
				if (nativeResolution !== resolution) await command([
					"set",
					...display,
					`--resolution=${resolution}`
				]);
			} else {
				if (await command(["get", "--proAvailable"]) !== "on") throw new Error("Custom resolutions require BetterDisplay Pro or its trial");
				created = `Chord /md ${target} ${resolution} ${v4()}`;
				const virtual = ["--type=VirtualScreen", `--name=${created}`];
				await command([
					"create",
					"--type=VirtualScreen",
					`--virtualScreenName=${created}`,
					"--useResolutionList=on",
					`--resolutionList=${resolution}`,
					"--virtualScreenHiDPI=on",
					"--connected=off"
				]);
				await command([
					"set",
					...virtual,
					"--connected=on"
				]);
				await selectVirtualResolution(command, virtual, resolution);
				await command([
					"set",
					...virtual,
					"--mirror=on",
					`--targetUUID=${target}`
				]);
				await waitFor(command, [
					"get",
					...virtual,
					"--mirror",
					`--targetUUID=${target}`
				], "on");
			}
			await waitFor(command, [
				"get",
				...display,
				"--resolution"
			], resolution);
		}
	} catch (error) {
		const failures = [error];
		const restore = async (operation) => {
			try {
				await operation();
			} catch (failure) {
				failures.push(failure);
			}
		};
		if (created) await restore(() => optional(command, [
			"discard",
			"--type=VirtualScreen",
			`--name=${created}`
		]));
		if (nativeResolution) await restore(async () => {
			if (await command([
				"get",
				...display,
				"--resolution"
			]) !== nativeResolution) await command([
				"set",
				...display,
				`--resolution=${nativeResolution}`
			]);
		});
		for (const entry of suspended) {
			await restore(() => command([
				"set",
				...screen(entry.tagID),
				"--connected=on"
			]));
			await restore(() => selectVirtualResolution(command, screen(entry.tagID), entry.resolution));
			await restore(() => command([
				"set",
				...screen(entry.tagID),
				"--mirror=on",
				`--targetUUID=${target}`
			]));
			await restore(() => waitFor(command, [
				"get",
				...screen(entry.tagID),
				"--mirror",
				`--targetUUID=${target}`
			], "on"));
		}
		if (failures.length > 1) throw new Error(`Could not change monitor resolution; rollback also failed: ${failures.map(String).join("; ")}`);
		throw error;
	}
	for (const entry of previous) await command(["discard", ...screen(entry.tagID)]);
}
/** Serialize changes so each command resolves the pointer after the previous switch settles. */
function createMonitorHandler(command) {
	let pending = Promise.resolve();
	return (expression) => {
		let resolution;
		try {
			resolution = expression === "0" ? "reset" : parseMonitorResolution(expression);
		} catch (error) {
			return Promise.reject(error);
		}
		const result = pending.then(() => setResolution(command, resolution));
		pending = result.catch(() => {});
		return result;
	};
}
function buildMonitorHandler() {
	return createMonitorHandler(createBetterDisplayCommand());
}
//#endregion
export { BetterDisplayError, createBetterDisplayCommand, createMonitorHandler, buildMonitorHandler as default, parseMonitorResolution };
