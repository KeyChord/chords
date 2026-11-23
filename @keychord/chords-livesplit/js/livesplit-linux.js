//#region src/js/livesplit/devtools.ts
const WEB_ORIGIN = "https://one.livesplit.org";
function connectionName(target) {
	return target === "webview2" ? "WebView2" : "Chromium DevTools";
}
function getSocketURL(target, endpoint, mode) {
	if (target.type !== "page" || mode === "webview2" && target.title !== "LiveSplit One" || typeof target.url !== "string" || typeof target.webSocketDebuggerUrl !== "string") return;
	try {
		const page = new URL(target.url);
		if (!(mode === "chromium" ? page.origin === WEB_ORIGIN : page.origin === "https://tauri.localhost" || page.origin === "http://tauri.localhost")) return;
		const socket = new URL(target.webSocketDebuggerUrl);
		if (socket.protocol === "ws:" && socket.hostname === endpoint.hostname && socket.port === endpoint.port && !socket.username && !socket.password && socket.pathname.startsWith("/devtools/page/")) return socket;
	} catch {}
}
function evaluate(url, body, mode) {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(url);
		const finish = (error, value) => {
			clearTimeout(timeout);
			socket.onopen = socket.onerror = socket.onmessage = socket.onclose = null;
			socket.close();
			if (error) reject(error);
			else resolve(value);
		};
		const connection = connectionName(mode);
		const timeout = setTimeout(() => finish(/* @__PURE__ */ new Error(`LiveSplit One did not respond to the ${connection} command.`)), 5e3);
		const guard = mode === "chromium" ? `if (location.origin !== ${JSON.stringify(WEB_ORIGIN)} || !document.hasFocus()) {
          throw new Error("Focus the LiveSplit One timer window before using this chord.");
        }` : "";
		socket.onopen = () => {
			socket.send(JSON.stringify({
				id: 1,
				method: "Runtime.evaluate",
				params: {
					expression: `(async () => { ${guard} ${body}\n })()`,
					awaitPromise: true,
					returnByValue: true
				}
			}));
		};
		socket.onerror = () => finish(/* @__PURE__ */ new Error(`Could not connect to LiveSplit One's ${connection}.`));
		socket.onclose = () => finish(/* @__PURE__ */ new Error("LiveSplit One closed before the command completed."));
		socket.onmessage = (event) => {
			try {
				const message = JSON.parse(String(event.data));
				if (message.id !== 1) return;
				const exception = message.result?.exceptionDetails;
				if (message.error || exception) finish(new Error(message.error?.message ?? exception?.exception?.description ?? exception?.text));
				else finish(void 0, message.result?.result?.value);
			} catch (error) {
				finish(error);
			}
		};
	});
}
async function runLiveSplitDevTools(body, port, mode) {
	const endpoint = new URL(`http://127.0.0.1:${port}/json/list`);
	let targets;
	try {
		const response = await fetch(endpoint, {
			redirect: "error",
			signal: AbortSignal.timeout(2e3)
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const value = await response.json();
		if (!Array.isArray(value)) throw new Error("Invalid DevTools target list");
		targets = value;
	} catch (cause) {
		throw new Error(`LiveSplit One's ${connectionName(mode)} endpoint is unavailable on port ${port}. Follow the LiveSplit Chords README for launch instructions.`, { cause });
	}
	const sockets = targets.flatMap((target) => {
		if (!target || typeof target !== "object") return [];
		const socket = getSocketURL(target, endpoint, mode);
		return socket ? [socket] : [];
	});
	if (!sockets.length) throw new Error("Open the LiveSplit One timer before using this chord.");
	if (sockets.length > 1) throw new Error("Close extra LiveSplit One windows before using this chord.");
	return evaluate(sockets[0], body, mode);
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
//#region src/js/livesplit/devtools-handler.ts
function buildDevToolsHandler(port, mode) {
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("The LiveSplit One debugging port must be an integer between 1 and 65535.");
	let previous = Promise.resolve();
	return function handler(action) {
		const pending = previous.then(async () => {
			const value = await runLiveSplitDevTools(buildLiveSplitJavaScript(action), port, mode);
			const result = JSON.parse(String(value));
			if (result.ok !== true) throw new Error(result.error ?? "LiveSplit One action failed.");
			return true;
		});
		previous = pending.catch(() => void 0);
		return pending;
	};
}
//#endregion
//#region src/js/livesplit-linux.ts
function buildHandler(port = 9423) {
	const run = buildDevToolsHandler(port, "chromium");
	return function handler(action) {
		if (this?.focusedAppId !== "org.livesplit.one") throw new Error("Focus the LiveSplit One timer window before using this chord.");
		return run(action);
	};
}
//#endregion
export { buildHandler as default };
