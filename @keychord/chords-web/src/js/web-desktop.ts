type Direction = "NORTH" | "SOUTH" | "EAST" | "WEST";
type Context = { focusedAppId: string | null };
type DebugTarget = { type?: unknown; webSocketDebuggerUrl?: unknown };
type Evaluation = {
  id?: number;
  error?: { message: string };
  result?: {
    result?: { value?: unknown };
    exceptionDetails?: { text: string; exception?: { description?: string } };
  };
};

const BROWSER_IDS = new Set([
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
  "executable.vivaldi-stable",
]);
const SCROLL_OFFSETS: Record<Direction, readonly [number, number]> = {
  NORTH: [0, -100],
  SOUTH: [0, 100],
  EAST: [100, 0],
  WEST: [-100, 0],
};

function evaluate(endpoint: URL, expression: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    function finish(error?: Error, value?: unknown) {
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve(value);
    }
    const timer = setTimeout(() => finish(new Error("Browser command timed out.")), 2000);
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true, awaitPromise: true },
        }),
      );
    };
    socket.onclose = socket.onerror = () =>
      finish(new Error("Browser debugging connection closed."));
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as Evaluation;
        if (message.id !== 1) return;
        const exception = message.result?.exceptionDetails;
        const failure =
          message.error?.message ?? exception?.exception?.description ?? exception?.text;
        if (failure) finish(new Error(failure));
        else finish(undefined, message.result?.result?.value);
      } catch (error) {
        finish(new Error("Invalid browser debugging response.", { cause: error }));
      }
    };
  });
}

function pageEndpoint(target: DebugTarget, port: number): URL | null {
  if (target.type !== "page" || typeof target.webSocketDebuggerUrl !== "string") return null;
  const url = URL.parse(target.webSocketDebuggerUrl);
  if (
    !url ||
    url.protocol !== "ws:" ||
    url.hostname !== "127.0.0.1" ||
    Number(url.port || 80) !== port ||
    url.username ||
    url.password ||
    !url.pathname.startsWith("/devtools/page/")
  )
    return null;
  return url;
}

async function focusedPage(port: number): Promise<URL> {
  let targets: DebugTarget[];
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    targets = await response.json();
    if (!Array.isArray(targets)) throw new Error("Expected a browser debugging target list.");
  } catch (error) {
    throw new Error(
      `Start your browser with remote debugging on port ${port}. See the Web Chords README.`,
      {
        cause: error,
      },
    );
  }

  const pages = targets.flatMap((target) => {
    const endpoint = target && pageEndpoint(target, port);
    return endpoint ? [endpoint] : [];
  });
  const focused = (
    await Promise.all(
      pages.map(async (endpoint) => {
        try {
          return (await evaluate(endpoint, "document.hasFocus()")) === true ? endpoint : null;
        } catch {
          // A closed or unresponsive tab should not prevent reaching the focused tab.
          return null;
        }
      }),
    )
  ).filter((endpoint) => endpoint !== null);
  if (focused.length !== 1)
    throw new Error("Focus one page in the browser's web content before scrolling.");
  return focused[0]!;
}

export default function buildHandler(port = 9222) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid browser debugging port.");
  return async function scroll(this: Context, direction: Direction) {
    if (!this.focusedAppId || !BROWSER_IDS.has(this.focusedAppId.toLowerCase())) {
      throw new Error("The focused app is not a supported Chromium browser.");
    }
    if (!Object.hasOwn(SCROLL_OFFSETS, direction)) throw new Error("Invalid web scroll direction.");
    const [left, top] = SCROLL_OFFSETS[direction];
    const endpoint = await focusedPage(port);
    const completed = await evaluate(
      endpoint,
      `document.hasFocus() && (
      window.scrollBy({ top: ${top}, left: ${left}, behavior: 'smooth' }), true
    )`,
    );
    if (completed !== true) throw new Error("Browser focus changed before scrolling.");
  };
}
