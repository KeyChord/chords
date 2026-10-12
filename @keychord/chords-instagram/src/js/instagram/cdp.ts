type Target = { type: string; url: string; webSocketDebuggerUrl?: string };
type Evaluation = {
  id?: number;
  error?: { message: string };
  result?: {
    result?: { value?: unknown };
    exceptionDetails?: { text: string; exception?: { description?: string } };
  };
};

function isInstagramTarget(target: Target): boolean {
  if (target.type !== "page" || !target.webSocketDebuggerUrl) return false;
  try {
    const { hostname } = new URL(target.url);
    return hostname === "instagram.com" || hostname.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

function evaluate(target: Target, expression: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl!);
    let finished = false;
    const finish = (error?: Error, value?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error("The Instagram app did not respond to the command.")),
      10_000,
    );
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true, awaitPromise: true, userGesture: true },
        }),
      );
    socket.onerror = () => finish(new Error("Could not connect to the Instagram app."));
    socket.onclose = () =>
      finish(new Error("The Instagram app closed before the command completed."));
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
        } else finish(undefined, message.result?.result?.value);
      } catch (error) {
        finish(error as Error);
      }
    };
  });
}

export async function runInstagramJavaScript(source: string, port: number): Promise<unknown> {
  let targets: Target[];
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    targets = ((await response.json()) as Target[]).filter(isInstagramTarget);
  } catch {
    throw new Error(
      `Brave's debugging endpoint on port ${port} is unavailable. If Brave is relaunching, try the chord again once Instagram is open. Otherwise use Chord's Brave Browser relaunch button or start Brave with --remote-debugging-port=${port}.`,
    );
  }
  if (!targets.length) throw new Error("Open the Instagram app before using Instagram chords.");

  let target = targets.length === 1 ? targets[0] : undefined;
  if (!target) {
    for (const candidate of targets) {
      if (await evaluate(candidate, "document.hasFocus()")) {
        target = candidate;
        break;
      }
    }
  }
  if (!target) throw new Error("Focus the Instagram app before using Instagram chords.");
  return evaluate(target, source);
}
