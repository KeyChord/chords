//#region src/js/web-desktop.ts
const BROWSER_IDS = /* @__PURE__ */ new Set([
	"com.google.chrome",
	"org.chromium.chromium",
	"com.brave.browser",
	"com.microsoft.edgemac",
	"com.operasoftware.opera",
	"com.vivaldi.vivaldi",
	"executable.chrome",
	"executable.google-chrome",
	"executable.google-chrome-stable",
	"executable.chromium",
	"executable.chromium-browser",
	"executable.brave",
	"executable.brave-browser",
	"executable.msedge",
	"executable.microsoft-edge",
	"executable.microsoft-edge-stable",
	"executable.opera",
	"executable.vivaldi",
	"executable.vivaldi-stable"
]);
const SCROLL_OFFSETS = {
	NORTH: [0, -100],
	SOUTH: [0, 100],
	EAST: [100, 0],
	WEST: [-100, 0]
};
function evaluate(endpoint, expression) {
	return new Promise((resolve, reject) => {
		const socket = new WebSocket(endpoint);
		function finish(error, value) {
			clearTimeout(timer);
			socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
			socket.close();
			if (error) reject(error);
			else resolve(value);
		}
		const timer = setTimeout(() => finish(/* @__PURE__ */ new Error("Browser command timed out.")), 2e3);
		socket.onopen = () => {
			socket.send(JSON.stringify({
				id: 1,
				method: "Runtime.evaluate",
				params: {
					expression,
					returnByValue: true,
					awaitPromise: true
				}
			}));
		};
		socket.onclose = socket.onerror = () => finish(/* @__PURE__ */ new Error("Browser debugging connection closed."));
		socket.onmessage = (event) => {
			try {
				const message = JSON.parse(String(event.data));
				if (message.id !== 1) return;
				const exception = message.result?.exceptionDetails;
				const failure = message.error?.message ?? exception?.exception?.description ?? exception?.text;
				if (failure) finish(new Error(failure));
				else finish(void 0, message.result?.result?.value);
			} catch (error) {
				finish(new Error("Invalid browser debugging response.", { cause: error }));
			}
		};
	});
}
function pageEndpoint(target, port) {
	if (target.type !== "page" || typeof target.webSocketDebuggerUrl !== "string") return null;
	const url = URL.parse(target.webSocketDebuggerUrl);
	if (!url || url.protocol !== "ws:" || url.hostname !== "127.0.0.1" || Number(url.port || 80) !== port || url.username || url.password || !url.pathname.startsWith("/devtools/page/")) return null;
	return url;
}
async function focusedPage(port) {
	let targets;
	try {
		const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
			signal: AbortSignal.timeout(2e3),
			redirect: "error"
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		targets = await response.json();
		if (!Array.isArray(targets)) throw new Error("Expected a browser debugging target list.");
	} catch (error) {
		throw new Error(`Start your browser with remote debugging on port ${port}. See the Web Chords README.`, { cause: error });
	}
	const pages = targets.flatMap((target) => {
		const endpoint = target && pageEndpoint(target, port);
		return endpoint ? [endpoint] : [];
	});
	const focused = (await Promise.all(pages.map(async (endpoint) => {
		try {
			return await evaluate(endpoint, "document.hasFocus()") === true ? endpoint : null;
		} catch {
			return null;
		}
	}))).filter((endpoint) => endpoint !== null);
	if (focused.length !== 1) throw new Error("Focus one page in the browser's web content before scrolling.");
	return focused[0];
}
function buildHandler(port = 9222) {
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid browser debugging port.");
	return async function scroll(direction) {
		if (!this.focusedAppId || !BROWSER_IDS.has(this.focusedAppId.toLowerCase())) throw new Error("The focused app is not a supported Chromium browser.");
		if (!Object.hasOwn(SCROLL_OFFSETS, direction)) throw new Error("Invalid web scroll direction.");
		const [left, top] = SCROLL_OFFSETS[direction];
		if (await evaluate(await focusedPage(port), `document.hasFocus() && (
      window.scrollBy({ top: ${top}, left: ${left}, behavior: 'smooth' }), true
    )`) !== true) throw new Error("Browser focus changed before scrolling.");
	};
}
//#endregion
export { buildHandler as default };
