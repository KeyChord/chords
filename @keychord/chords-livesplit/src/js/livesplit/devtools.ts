const WEB_ORIGIN = "https://one.livesplit.org";

export type LiveSplitTarget = "webview2" | "chromium";

function connectionName(target: LiveSplitTarget): string {
  return target === "webview2" ? "WebView2" : "Chromium DevTools";
}

type Target = {
  type?: unknown;
  title?: unknown;
  url?: unknown;
  webSocketDebuggerUrl?: unknown;
};

type Evaluation = {
  id?: number;
  error?: { message: string };
  result?: {
    result?: { value?: unknown };
    exceptionDetails?: { text: string; exception?: { description?: string } };
  };
};

function getSocketURL(target: Target, endpoint: URL, mode: LiveSplitTarget): URL | undefined {
  if (
    target.type !== "page" ||
    (mode === "webview2" && target.title !== "LiveSplit One") ||
    typeof target.url !== "string" ||
    typeof target.webSocketDebuggerUrl !== "string"
  ) {
    return;
  }

  try {
    const page = new URL(target.url);
    // Tauri uses https://tauri.localhost for newer LiveSplit One desktop builds.
    const allowed =
      mode === "chromium"
        ? page.origin === WEB_ORIGIN
        : page.origin === "https://tauri.localhost" || page.origin === "http://tauri.localhost";
    if (!allowed) return;

    const socket = new URL(target.webSocketDebuggerUrl);
    if (
      socket.protocol === "ws:" &&
      socket.hostname === endpoint.hostname &&
      socket.port === endpoint.port &&
      !socket.username &&
      !socket.password &&
      socket.pathname.startsWith("/devtools/page/")
    ) {
      return socket;
    }
  } catch {
    // The endpoint may list targets outside the app.
  }
}

function evaluate(url: URL, body: string, mode: LiveSplitTarget): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const finish = (error?: Error, value?: unknown) => {
      clearTimeout(timeout);
      socket.onopen = socket.onerror = socket.onmessage = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    const connection = connectionName(mode);
    const timeout = setTimeout(
      () => finish(new Error(`LiveSplit One did not respond to the ${connection} command.`)),
      5_000,
    );
    const guard =
      mode === "chromium"
        ? `if (location.origin !== ${JSON.stringify(WEB_ORIGIN)} || !document.hasFocus()) {
          throw new Error("Focus the LiveSplit One timer window before using this chord.");
        }`
        : "";
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression: `(async () => { ${guard} ${body}\n })()`,
            awaitPromise: true,
            returnByValue: true,
          },
        }),
      );
    };
    socket.onerror = () => finish(new Error(`Could not connect to LiveSplit One's ${connection}.`));
    socket.onclose = () => finish(new Error("LiveSplit One closed before the command completed."));
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as Evaluation;
        if (message.id !== 1) return;
        const exception = message.result?.exceptionDetails;
        if (message.error || exception) {
          finish(
            new Error(
              message.error?.message ?? exception?.exception?.description ?? exception?.text,
            ),
          );
        } else {
          finish(undefined, message.result?.result?.value);
        }
      } catch (error) {
        finish(error as Error);
      }
    };
  });
}

export async function runLiveSplitDevTools(
  body: string,
  port: number,
  mode: LiveSplitTarget,
): Promise<unknown> {
  const endpoint = new URL(`http://127.0.0.1:${port}/json/list`);
  let targets: Target[];
  try {
    const response = await fetch(endpoint, {
      redirect: "error",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const value: unknown = await response.json();
    if (!Array.isArray(value)) throw new Error("Invalid DevTools target list");
    targets = value;
  } catch (cause) {
    throw new Error(
      `LiveSplit One's ${connectionName(mode)} endpoint is unavailable on port ${port}. Follow the LiveSplit Chords README for launch instructions.`,
      { cause },
    );
  }
  const sockets = targets.flatMap((target) => {
    if (!target || typeof target !== "object") return [];
    const socket = getSocketURL(target, endpoint, mode);
    return socket ? [socket] : [];
  });
  if (!sockets.length) throw new Error("Open the LiveSplit One timer before using this chord.");
  if (sockets.length > 1)
    throw new Error("Close extra LiveSplit One windows before using this chord.");
  return evaluate(sockets[0]!, body, mode);
}
