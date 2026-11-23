type Target = { type?: unknown; url?: unknown; webSocketDebuggerUrl?: unknown };
type Evaluation = {
  id?: number;
  error?: { message: string };
  result?: {
    result?: { value?: unknown };
    exceptionDetails?: { text: string; exception?: { description?: string } };
  };
};

function youtubePageEndpoint(target: Target | null, port: number): string | undefined {
  if (
    target?.type !== "page" ||
    typeof target.url !== "string" ||
    typeof target.webSocketDebuggerUrl !== "string"
  )
    return;
  const page = URL.parse(target.url);
  if (
    !page ||
    page.protocol !== "https:" ||
    !(page.hostname === "youtube.com" || page.hostname.endsWith(".youtube.com"))
  )
    return;
  const socket = URL.parse(target.webSocketDebuggerUrl);
  if (
    socket?.protocol === "ws:" &&
    socket.hostname === "127.0.0.1" &&
    Number(socket.port || 80) === port &&
    !socket.username &&
    !socket.password &&
    socket.pathname.startsWith("/devtools/page/")
  )
    return socket.href;
}

function evaluate(endpoint: string, expression: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const finish = (error?: Error, value?: unknown) => {
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error("The YouTube app did not respond to the command.")),
      5000,
    );
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true, awaitPromise: true, userGesture: true },
        }),
      );
    socket.onerror = () => finish(new Error("Could not connect to the YouTube app."));
    socket.onclose = () =>
      finish(new Error("The YouTube app closed before the command completed."));
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

export async function runYouTubeJavaScript(
  source: string,
  port: number,
  requireFocusedPage: boolean,
): Promise<unknown> {
  let pages: string[];
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    pages = ((await response.json()) as (Target | null)[]).flatMap((target) => {
      const endpoint = youtubePageEndpoint(target, port);
      return endpoint ? [endpoint] : [];
    });
  } catch (error) {
    throw new Error(
      `Start your browser with --remote-debugging-port=${port} before using YouTube chords. See the chords-youtube README for setup.`,
      { cause: error },
    );
  }
  if (pages.length === 0)
    throw new Error("Open the YouTube app or a YouTube tab before using these chords.");

  // The macOS binding is already scoped to the Brave web app. Desktop bindings
  // are global, so even a single discovered tab needs to have document focus.
  if (!requireFocusedPage && pages.length === 1) return evaluate(pages[0]!, source);
  const focused = (
    await Promise.all(
      pages.map(async (endpoint) => {
        try {
          return (await evaluate(endpoint, "document.hasFocus()")) === true ? endpoint : undefined;
        } catch {
          return undefined;
        }
      }),
    )
  ).filter((endpoint) => endpoint !== undefined);
  if (focused.length !== 1)
    throw new Error("Focus the YouTube app or the web content in one YouTube tab.");
  if (!requireFocusedPage) return evaluate(focused[0]!, source);

  // Recheck in the same evaluation that changes the player. The target can
  // lose focus or navigate between the discovery call and this call.
  const guarded = `document.hasFocus() && location.protocol === "https:" &&
    (location.hostname === "youtube.com" || location.hostname.endsWith(".youtube.com"))
      ? (${source})
      : null`;
  const result = await evaluate(focused[0]!, guarded);
  if (result === null) throw new Error("YouTube lost focus before the command ran.");
  return result;
}
