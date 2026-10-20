//#region src/js/livesplit/bridge.ts
const RESPONSE_TIMEOUT = 5e3;
const LOAD_TIMEOUT = 6e4;
async function run(command, timeout = 5e3) {
	const child = Bun.spawn(command, {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		timeout
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text()
	]);
	return {
		exitCode: child.signalCode ? null : exitCode,
		stdout,
		stderr
	};
}
async function findProcess(processName) {
	const { exitCode, stdout, stderr } = await run([
		"/bin/ps",
		"-axo",
		"pid=,comm="
	]);
	if (exitCode !== 0) throw new Error(stderr.trim() || "Could not list running processes.");
	const pids = stdout.split("\n").map((line) => /^\s*(\d+)\s+(.+)$/.exec(line)).filter((match) => match && match[2].split("/").pop() === processName).map((match) => Number(match[1]));
	if (pids.length === 0) throw new Error(`Open ${processName} before using LiveSplit chords.`);
	if (pids.length > 1) throw new Error(`Close extra ${processName} instances first.`);
	return pids[0];
}
async function socketPath(pid) {
	const { exitCode, stdout } = await run(["/usr/bin/getconf", "DARWIN_USER_TEMP_DIR"]);
	const directory = stdout.trim().replace(/\/$/, "");
	if (exitCode !== 0 || !directory) throw new Error("Could not find the user's temporary directory.");
	return `${directory}/keychord-livesplit-${pid}.sock`;
}
var BridgeUnavailableError = class extends Error {};
function request(path, body) {
	return new Promise((resolve, reject) => {
		let pending = Buffer.from(`${JSON.stringify({ body })}\n`);
		let text = "";
		const decoder = new TextDecoder();
		let settled = false;
		let connection;
		const finish = (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			connection?.end();
			if (error) return reject(error);
			try {
				resolve(JSON.parse(text));
			} catch {
				reject(/* @__PURE__ */ new Error("LiveSplit One closed the bridge connection without a response."));
			}
		};
		const timer = setTimeout(() => finish(/* @__PURE__ */ new Error("LiveSplit One did not respond to the command.")), RESPONSE_TIMEOUT);
		const flush = (socket) => {
			const written = socket.write(pending);
			if (written > 0) pending = pending.subarray(written);
		};
		const unavailable = (error) => finish(error.code === "ENOENT" || error.code === "ECONNREFUSED" ? new BridgeUnavailableError(error.message) : error);
		Bun.connect({
			unix: path,
			socket: {
				open(socket) {
					connection = socket;
					flush(socket);
				},
				drain: flush,
				data(_socket, data) {
					text += decoder.decode(data, { stream: true });
				},
				close: () => finish(),
				error: (_socket, error) => finish(error),
				connectError: (_socket, error) => unavailable(error)
			}
		}).catch(unavailable);
	});
}
function lldbString(value) {
	return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}
async function loadBridge(pid, { processName, library }) {
	if (!await Bun.file(library).exists()) throw new Error(`The LiveSplit bridge is missing at ${library}. Run \`vp run build:bridge\` in @keychord/chords-livesplit.`);
	if ((await run(["/usr/bin/xcode-select", "-p"])).exitCode !== 0) throw new Error(`Loading the bridge into a running ${processName} needs lldb. Install the Xcode Command Line Tools with \`xcode-select --install\`, or start ${processName} with DYLD_INSERT_LIBRARIES as described in the chords-livesplit README.`);
	const output = await run([
		"/usr/bin/lldb",
		"--no-lldbinit",
		"--batch",
		"--attach-pid",
		String(pid),
		"--one-line",
		`process load ${lldbString(library)}`,
		"--one-line",
		"process detach"
	], LOAD_TIMEOUT);
	const errors = `${output.stdout}\n${output.stderr}`.split("\n").filter((line) => /^error:/i.test(line.trim())).join(" ");
	if (output.exitCode === null) throw new Error(`lldb timed out while loading the bridge into ${processName}.`);
	if (errors) throw new Error(`Could not load the bridge into ${processName}: ${errors}`);
}
/**
* Runs an async function body in LiveSplit One's web view and returns its result. The first call
* for a LiveSplit One process loads the bridge into it with lldb.
*/
async function runLiveSplitJavaScript(body, options) {
	const pid = await findProcess(options.processName);
	const path = await socketPath(pid);
	let response;
	try {
		response = await request(path, body);
	} catch (error) {
		if (!(error instanceof BridgeUnavailableError)) throw error;
		await loadBridge(pid, options);
		try {
			response = await request(path, body);
		} catch (retryError) {
			if (!(retryError instanceof BridgeUnavailableError)) throw retryError;
			throw new Error(`The bridge did not start in ${options.processName}.`);
		}
	}
	if (!response.ok) throw new Error(response.error ?? `${options.processName} rejected the command.`);
	return response.value;
}
//#endregion
//#region src/js/livesplit/page.ts
const ACTIONS = ["TOGGLE_MILLISECONDS"];
async function runInPage(action) {
	try {
		if (action !== "TOGGLE_MILLISECONDS") throw new Error(`Unknown LiveSplit One action: ${String(action)}`);
		const accuracies = [
			"Seconds",
			"Tenths",
			"Hundredths",
			"Milliseconds"
		];
		const storageKey = "keychord.livesplit.accuracies";
		const base = document.getElementById("base");
		const containerKey = base && Object.keys(base).find((key) => key.startsWith("__reactContainer$"));
		const fibers = containerKey ? [base[containerKey]] : [];
		let found;
		while (fibers.length > 0 && !found) {
			const fiber = fibers.pop();
			if (!fiber) continue;
			const node = fiber.stateNode;
			if (typeof node?.saveLayout === "function" && typeof node.setLayout === "function" && node.state?.layout) found = node;
			else fibers.push(fiber.sibling, fiber.child);
		}
		if (!found) throw new Error("LiveSplit One has not finished loading.");
		const app = found;
		if (typeof app.state.menu?.editor?.addComponent === "function") throw new Error("Close LiveSplit One's layout editor before toggling milliseconds.");
		const isAccuracy = (value) => typeof value === "string" && accuracies.includes(value);
		const lookup = (node, path) => path.reduce((value, key) => value && typeof value === "object" ? value[key] : void 0, node);
		const sameField = (a, b) => a.component === b.component && a.type === b.type && a.path.join("\0") === b.path.join("\0");
		function accuracyFields(settings) {
			const fields = [];
			settings.components.forEach((component, index) => {
				if (!component || typeof component !== "object") return;
				const [type, value] = Object.entries(component)[0] ?? [];
				const visit = (node, path) => {
					if (!node || typeof node !== "object") return;
					for (const [key, child] of Object.entries(node)) if (/(?:^|_)accuracy$/.test(key) && isAccuracy(child)) fields.push({
						component: index,
						type,
						path: [...path, key],
						value: child
					});
					else visit(child, [...path, key]);
				};
				if (type) visit(value, []);
			});
			return fields;
		}
		const current = app.state.layout;
		const Layout = current.constructor;
		const settings = current.settingsAsJson();
		const fields = accuracyFields(settings);
		if (fields.length === 0) throw new Error("The current LiveSplit One layout shows no times with an accuracy setting.");
		const enable = fields.some((field) => field.value !== "Milliseconds");
		let saved = [];
		if (!enable) try {
			const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
			if (Array.isArray(parsed)) saved = parsed;
		} catch {}
		const defaults = /* @__PURE__ */ new Map();
		function defaultAccuracy(field) {
			if (!defaults.has(field.type)) {
				const parsed = Layout.parseJson({
					components: [{ [field.type]: {} }],
					general: {}
				});
				defaults.set(field.type, (parsed?.settingsAsJson().components[0])?.[field.type]);
				parsed?.[Symbol.dispose]();
			}
			return lookup(defaults.get(field.type), field.path);
		}
		for (const field of fields) {
			let value = "Milliseconds";
			if (!enable) {
				value = saved.find((entry) => sameField(entry, field))?.value;
				if (!isAccuracy(value)) value = defaultAccuracy(field);
				if (!isAccuracy(value)) value = "Hundredths";
			}
			const component = settings.components[field.component][field.type];
			const parent = lookup(component, field.path.slice(0, -1));
			parent[field.path.at(-1)] = value;
		}
		const next = Layout.parseJson(settings);
		if (!next) throw new Error("LiveSplit One rejected the updated layout.");
		const hadUnsavedChanges = app.state.layoutModified;
		app.setLayout(next);
		await new Promise((resolve) => app.setState({}, resolve));
		if (!hadUnsavedChanges) await app.saveLayout();
		if (enable) localStorage.setItem(storageKey, JSON.stringify(fields));
		else localStorage.removeItem(storageKey);
		return JSON.stringify({
			ok: true,
			milliseconds: enable
		});
	} catch (error) {
		return JSON.stringify({
			ok: false,
			error: error.message
		});
	}
}
/** Returns the body of an async function, as WKWebView's callAsyncJavaScript expects. */
function buildLiveSplitJavaScript(action) {
	if (!ACTIONS.includes(action)) throw new Error(`Unknown LiveSplit One action: ${action}`);
	return `return await (${runInPage.toString()})(${JSON.stringify(action)});`;
}
//#endregion
//#region src/js/livesplit.ts
const bridgeLibrary = Bun.fileURLToPath(new URL("../target/aarch64-apple-darwin/livesplit-bridge/livesplit-bridge.dylib", import.meta.url));
function buildHandler(processName = "LiveSplit One") {
	if (typeof processName !== "string" || !processName.trim() || processName.includes("/")) throw new Error("The LiveSplit One process name must be a non-empty executable name.");
	let previous = Promise.resolve();
	return function handler(action) {
		const pending = previous.then(async () => {
			const value = await runLiveSplitJavaScript(buildLiveSplitJavaScript(action), {
				processName,
				library: bridgeLibrary
			});
			const result = JSON.parse(String(value));
			if (result.ok !== true) throw new Error(result.error ?? "LiveSplit One action failed.");
			return true;
		});
		previous = pending.catch(() => void 0);
		return pending;
	};
}
//#endregion
export { buildHandler as default };
