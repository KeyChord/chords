import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { fileURLToPath as fileURLToPath$1 } from "url";
import { dirname, join } from "path";
import { onAppLaunch, onAppTerminate, setAppNeedsRelaunch } from "chord";
import net from "node:net";
import os from "node:os";
//#region ../../node_modules/.pnpm/ansi-regex@6.2.2/node_modules/ansi-regex/index.js
function ansiRegex({ onlyFirst = false } = {}) {
	return new RegExp(`(?:\\u001B\\][\\s\\S]*?(?:\\u0007|\\u001B\\u005C|\\u009C))|[\\u001B\\u009B][[\\]()#;?]*(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]`, onlyFirst ? void 0 : "g");
}
//#endregion
//#region ../../node_modules/.pnpm/strip-ansi@7.2.0/node_modules/strip-ansi/index.js
const regex = ansiRegex();
function stripAnsi(string) {
	if (typeof string !== "string") throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``);
	if (!string.includes("\x1B") && !string.includes("")) return string;
	return string.replace(regex, "");
}
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/context.js
const getContext = (raw) => ({
	start: process.hrtime.bigint(),
	command: raw.map((part) => getCommandPart(stripAnsi(part))).join(" "),
	state: {
		stdout: "",
		stderr: "",
		output: "",
		isIterating: {},
		nonIterable: [false, false]
	}
});
const getCommandPart = (part) => /[^\w./-]/.test(part) ? `'${part.replaceAll("'", "'\\''")}'` : part;
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/options.js
const getOptions = ({ stdin, stdout, stderr, stdio = [
	stdin,
	stdout,
	stderr
], env: envOption, preferLocal, cwd: cwdOption = ".", ...options }) => {
	const cwd = cwdOption instanceof URL ? fileURLToPath(cwdOption) : path.resolve(cwdOption);
	const env = envOption ? {
		...process.env,
		...envOption
	} : void 0;
	const input = stdio[0]?.string;
	return {
		...options,
		input,
		stdio: input === void 0 ? stdio : ["pipe", ...stdio.slice(1)],
		env: preferLocal ? addLocalPath(env ?? process.env, cwd) : env,
		cwd
	};
};
const addLocalPath = ({ Path = "", PATH = Path, ...env }, cwd) => {
	const pathParts = PATH.split(path.delimiter);
	const localPaths = getLocalPaths([], path.resolve(cwd)).map((localPath) => path.join(localPath, "node_modules/.bin")).filter((localPath) => !pathParts.includes(localPath));
	return {
		...env,
		PATH: [...localPaths, PATH].filter(Boolean).join(path.delimiter)
	};
};
const getLocalPaths = (localPaths, localPath) => localPaths.at(-1) === localPath ? localPaths : getLocalPaths([...localPaths, localPath], path.resolve(localPath, ".."));
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/windows.js
const applyForceShell = async (file, commandArguments, options) => await shouldForceShell(file, options) ? [
	escapeFile(file),
	commandArguments.map((argument) => escapeArgument(argument)),
	{
		...options,
		shell: true
	}
] : [
	file,
	commandArguments,
	options
];
const shouldForceShell = async (file, { shell, cwd, env = process.env }) => process.platform === "win32" && !shell && !await isExe(file, cwd, env);
const isExe = (file, cwd, { Path = "", PATH = Path }) => exeExtensions.some((extension) => file.toLowerCase().endsWith(extension)) || mIsExe(file, cwd, PATH);
const EXE_MEMO = {};
const memoize = (function_) => (...arguments_) => EXE_MEMO[arguments_.join("\0")] ??= function_(...arguments_);
const access = memoize(fs.access);
const mIsExe = memoize(async (file, cwd, PATH) => {
	const parts = PATH.split(path.delimiter).filter(Boolean).map((part) => part.replace(/^"(.*)"$/, "$1"));
	try {
		await Promise.any([cwd, ...parts].flatMap((part) => exeExtensions.map((extension) => access(`${path.resolve(part, file)}${extension}`))));
	} catch {
		return false;
	}
	return true;
});
const exeExtensions = [".exe", ".com"];
const escapeArgument = (argument) => escapeFile(escapeFile(`"${argument.replaceAll(/(\\*)"/g, "$1$1\\\"").replace(/(\\*)$/, "$1$1")}"`));
const escapeFile = (file) => file.replaceAll(/([()\][%!^"`<>&|;, *?])/g, "^$1");
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/once.js
function once(emitter, event) {
	return new Promise((resolve, reject) => {
		function onEvent(...arguments_) {
			cleanup();
			resolve(arguments_);
		}
		function onError(error) {
			cleanup();
			reject(error);
		}
		function cleanup() {
			if (emitter.off) {
				emitter.off(event, onEvent);
				emitter.off("error", onError);
			}
			if (emitter.removeListener) {
				emitter.removeListener(event, onEvent);
				emitter.removeListener("error", onError);
			}
		}
		emitter.on(event, onEvent);
		if (event !== "error") emitter.on("error", onError);
	});
}
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/result.js
const getResult = async (nodeChildProcess, { input }, context) => {
	const instance = await nodeChildProcess;
	if (input !== void 0) {
		instance.stdin.write(input);
		instance.stdin.end();
	}
	const onClose = once(instance, "close");
	try {
		await Promise.race([onClose, ...[
			instance.stdin,
			instance.stdout,
			instance.stderr
		].filter(Boolean).map((stream) => onStreamError(stream))]);
		checkFailure(context, getErrorOutput(instance));
		return getOutputs(context);
	} catch (error) {
		await Promise.allSettled([onClose]);
		throw getResultError(error, instance, context);
	}
};
const onStreamError = (stream) => new Promise((_resolve, reject) => {
	stream.on("error", (error) => {
		if (!["ERR_STREAM_PREMATURE_CLOSE", "EPIPE"].includes(error?.code)) reject(error);
	});
});
const checkFailure = ({ command }, { exitCode, signalName }) => {
	if (signalName !== void 0) throw new SubprocessError(`Command was terminated with ${signalName}: ${command}`);
	if (exitCode !== void 0) throw new SubprocessError(`Command failed with exit code ${exitCode}: ${command}`);
};
const getResultError = (error, instance, context) => Object.assign(getErrorInstance(error, context), getErrorOutput(instance), getOutputs(context));
const getErrorInstance = (error, { command }) => error instanceof SubprocessError ? error : new SubprocessError(`Command failed: ${command}`, { cause: error });
var SubprocessError = class extends Error {
	name = "SubprocessError";
};
const getErrorOutput = ({ exitCode, signalCode }) => ({
	...exitCode < 1 ? {} : { exitCode },
	...signalCode === null ? {} : { signalName: signalCode }
});
const getOutputs = ({ state: { stdout, stderr, output }, command, start }) => ({
	stdout: getOutput(stdout),
	stderr: getOutput(stderr),
	output: getOutput(output),
	command,
	durationMs: Number(process.hrtime.bigint() - start) / 1e6
});
const getOutput = (output) => output.at(-1) === "\n" ? output.slice(0, output.at(-2) === "\r" ? -2 : -1) : output;
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/spawn.js
const spawnSubprocess = async (file, commandArguments, options, context) => {
	try {
		[file, commandArguments, options] = await applyForceShell(file, commandArguments, options);
		[file, commandArguments, options] = concatenateShell(file, commandArguments, options);
		const instance = spawn(file, commandArguments, options);
		bufferOutput(instance.stdout, context, "stdout");
		bufferOutput(instance.stderr, context, "stderr");
		instance.once("error", () => {});
		return instance;
	} catch (error) {
		throw getResultError(error, {}, context);
	}
};
const concatenateShell = (file, commandArguments, options) => options.shell && commandArguments.length > 0 ? [
	[file, ...commandArguments].join(" "),
	[],
	options
] : [
	file,
	commandArguments,
	options
];
const bufferOutput = (stream, { state }, streamName) => {
	if (stream) {
		stream.setEncoding?.("utf8");
		if (!state.isIterating[streamName]) {
			state.isIterating[streamName] = false;
			stream.on("data", (chunk) => {
				state[streamName] += chunk;
				state.output += chunk;
			});
		}
	}
};
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/pipe.js
const handlePipe = async (subprocesses) => {
	const [[from, to]] = await Promise.all([Promise.allSettled(subprocesses), pipeStreams(subprocesses)]);
	if (to.reason) {
		to.reason.pipedFrom = from.reason ?? from.value;
		throw to.reason;
	}
	if (from.reason) throw from.reason;
	return {
		...to.value,
		pipedFrom: from.value
	};
};
const pipeStreams = async (subprocesses) => {
	try {
		const [{ stdout }, { stdin }] = await Promise.all(subprocesses.map(({ nodeChildProcess }) => nodeChildProcess));
		if (stdin === null) throw new Error("The \"stdin\" option must be set on the first \"spawn()\" call in the pipeline.");
		if (stdout === null) throw new Error("The \"stdout\" option must be set on the last \"spawn()\" call in the pipeline.");
		pipeline(stdout, stdin).catch(() => {});
	} catch (error) {
		await Promise.allSettled(subprocesses.map(({ nodeChildProcess }) => closeStdin(nodeChildProcess)));
		throw error;
	}
};
const closeStdin = async (nodeChildProcess) => {
	const { stdin } = await nodeChildProcess;
	stdin.end();
};
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/iterable.js
const lineIterator = async function* (subprocess, { state }, streamName, index) {
	if (state.isIterating[streamName] === false) throw new Error(`The subprocess must be iterated right away, for example:
	for await (const line of spawn(...)) { ... }`);
	state.isIterating[streamName] = true;
	try {
		const { [streamName]: stream } = await subprocess.nodeChildProcess;
		if (!stream) {
			state.nonIterable[index] = true;
			const message = state.nonIterable.every(Boolean) ? "either the option `stdout` or `stderr`" : `the option \`${streamName}\``;
			throw new TypeError(`The subprocess cannot be iterated unless ${message} is 'pipe'.`);
		}
		handleErrors(subprocess);
		let buffer = "";
		for await (const chunk of stream.iterator({ destroyOnReturn: false })) {
			const lines = `${buffer}${chunk}`.split(/\r?\n/);
			buffer = lines.pop();
			yield* lines;
		}
		if (buffer) yield buffer;
	} finally {
		await subprocess;
	}
};
const handleErrors = async (subprocess) => {
	try {
		await subprocess;
	} catch {}
};
const combineAsyncIterators = async function* ({ state }, ...iterators) {
	try {
		let promises = [];
		while (iterators.length > 0) {
			promises = iterators.map((iterator, index) => promises[index] ?? getNext(iterator, index, state));
			const [{ value, done }, index] = await Promise.race(promises.map((promise, index) => Promise.all([promise, index])));
			const [iterator] = iterators.splice(index, 1);
			promises.splice(index, 1);
			if (!done) {
				iterators.push(iterator);
				yield value;
			}
		}
	} finally {
		await Promise.all(iterators.map((iterator) => iterator.return()));
	}
};
const getNext = async (iterator, index, { nonIterable }) => {
	try {
		return await iterator.next();
	} catch (error) {
		return shouldIgnoreError(nonIterable, index) ? iterator.return() : iterator.throw(error);
	}
};
const shouldIgnoreError = (nonIterable, index) => nonIterable.every(Boolean) ? index !== nonIterable.length - 1 : nonIterable[index];
//#endregion
//#region ../../node_modules/.pnpm/nano-spawn-compat@2.0.6/node_modules/nano-spawn-compat/source/index.js
function spawn$1(file, second, third, previous) {
	const [commandArguments = [], options = {}] = Array.isArray(second) ? [second, third] : [[], second];
	const context = getContext([file, ...commandArguments]);
	const spawnOptions = getOptions(options);
	const nodeChildProcess = spawnSubprocess(file, commandArguments, spawnOptions, context);
	let subprocess = getResult(nodeChildProcess, spawnOptions, context);
	Object.assign(subprocess, { nodeChildProcess });
	subprocess = previous ? handlePipe([previous, subprocess]) : subprocess;
	const stdout = lineIterator(subprocess, context, "stdout", 0);
	const stderr = lineIterator(subprocess, context, "stderr", 1);
	return Object.assign(subprocess, {
		nodeChildProcess,
		stdout,
		stderr,
		[Symbol.asyncIterator]: () => combineAsyncIterators(context, stdout, stderr),
		pipe: (file, second, third) => spawn$1(file, second, third, subprocess)
	});
}
//#endregion
//#region ../../node_modules/.pnpm/desm@1.3.1/node_modules/desm/index.js
function urlDirname(url) {
	return dirname(fileURLToPath$1(url));
}
function urlJoin(url, ...str) {
	return join(urlDirname(url), ...str);
}
//#endregion
//#region ../../node_modules/.pnpm/get-port@7.2.0/node_modules/get-port/index.js
var Locked = class extends Error {
	constructor(port) {
		super(`${port} is locked`);
	}
};
const lockedPorts = {
	old: /* @__PURE__ */ new Set(),
	young: /* @__PURE__ */ new Set()
};
const releaseOldLockedPortsIntervalMs = 1e3 * 15;
const reservedPorts = /* @__PURE__ */ new Set();
let timeout;
const getLocalHosts = () => {
	const interfaces = os.networkInterfaces();
	const results = new Set([void 0, "0.0.0.0"]);
	for (const _interface of Object.values(interfaces)) for (const config of _interface) results.add(config.address);
	return results;
};
const checkAvailablePort = (options) => new Promise((resolve, reject) => {
	const server = net.createServer();
	server.unref();
	server.on("error", reject);
	server.listen(options, () => {
		const { port } = server.address();
		server.close(() => {
			resolve(port);
		});
	});
});
const getAvailablePort = async (options, hosts) => {
	if (options.host || options.port === 0) return checkAvailablePort(options);
	for (const host of hosts) try {
		await checkAvailablePort({
			port: options.port,
			host
		});
	} catch (error) {
		if (!["EADDRNOTAVAIL", "EINVAL"].includes(error.code)) throw error;
	}
	return options.port;
};
const isLockedPort = (port) => lockedPorts.old.has(port) || lockedPorts.young.has(port) || reservedPorts.has(port);
const portCheckSequence = function* (ports) {
	if (ports) yield* ports;
	yield 0;
};
async function getPorts(options) {
	let ports;
	let exclude = /* @__PURE__ */ new Set();
	if (options) {
		if (options.port) ports = typeof options.port === "number" ? [options.port] : options.port;
		if (options.exclude) {
			const excludeIterable = options.exclude;
			if (typeof excludeIterable[Symbol.iterator] !== "function") throw new TypeError("The `exclude` option must be an iterable.");
			for (const element of excludeIterable) {
				if (typeof element !== "number") throw new TypeError("Each item in the `exclude` option must be a number corresponding to the port you want excluded.");
				if (!Number.isSafeInteger(element)) throw new TypeError(`Number ${element} in the exclude option is not a safe integer and can't be used`);
			}
			exclude = new Set(excludeIterable);
		}
	}
	const { reserve, ...netOptions } = options ?? {};
	if (timeout === void 0) {
		timeout = setTimeout(() => {
			timeout = void 0;
			lockedPorts.old = lockedPorts.young;
			lockedPorts.young = /* @__PURE__ */ new Set();
		}, releaseOldLockedPortsIntervalMs);
		if (timeout.unref) timeout.unref();
	}
	const hosts = getLocalHosts();
	for (const port of portCheckSequence(ports)) try {
		if (exclude.has(port)) continue;
		let availablePort = await getAvailablePort({
			...netOptions,
			port
		}, hosts);
		while (isLockedPort(availablePort)) {
			if (port !== 0) throw new Locked(port);
			availablePort = await getAvailablePort({
				...netOptions,
				port
			}, hosts);
		}
		if (reserve) reservedPorts.add(availablePort);
		else lockedPorts.young.add(availablePort);
		return availablePort;
	} catch (error) {
		if (!["EADDRINUSE", "EACCES"].includes(error.code) && !(error instanceof Locked)) throw error;
	}
	throw new Error("No available ports found");
}
//#endregion
//#region src/js/chrome.ts
async function createChromiumHandler(appPath) {
	let isPendingRestart = false;
	let remoteDebuggingPort = null;
	if (this.enableDebuggingPort) {
		setAppNeedsRelaunch(this.bundleId, true);
		const hasRemoteDebuggingPort = async (pid) => {
			const { stdout } = await spawn$1("ps", [
				"-p",
				pid.toString(),
				"-o",
				"command="
			]);
			return stdout.includes("remote-debugging-port");
		};
		onAppLaunch(this.bundleId, async (app) => {
			if (!await hasRemoteDebuggingPort(app.pid)) {
				isPendingRestart = true;
				await spawn$1("kill", ["-15", app.pid.toString()]);
			}
		});
		onAppTerminate(this.bundleId, async () => {
			if (isPendingRestart) {
				isPendingRestart = false;
				remoteDebuggingPort = await getPorts();
				await spawn$1("open", [
					"-na",
					appPath,
					"--args",
					`--remote-debugging-port=${remoteDebuggingPort}`
				]);
			}
		});
	}
	const chromeRemoteInterfaceBinPath = urlJoin(import.meta.url, "../bin/chrome-remote-interface");
	async function handlerJs(code) {
		if (!remoteDebuggingPort) return false;
		await spawn$1(chromeRemoteInterfaceBinPath, [remoteDebuggingPort.toString()], { stdin: { string: code } });
	}
	return async function handler(action, code) {
		if (action === "js") return handlerJs(code);
		return false;
	};
}
//#endregion
export { createChromiumHandler as default };
