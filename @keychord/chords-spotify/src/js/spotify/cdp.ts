type Target = { type: string; url: string; webSocketDebuggerUrl?: string };
type Evaluation = {
  id?: number;
  error?: { message: string };
  result?: {
    result?: { value?: unknown };
    exceptionDetails?: { text: string; exception?: { description?: string } };
  };
};

function isSpotifyTarget(target: Target): boolean {
  if (target.type !== "page" || !target.webSocketDebuggerUrl) return false;
  try {
    return new URL(target.url).hostname === "xpui.app.spotify.com";
  } catch {
    return false;
  }
}

function evaluate(target: Target, expression: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl!);
    let settled = false;
    const finish = (error?: Error, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error("The Spotify app did not respond to the command.")),
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
    socket.onerror = () => finish(new Error("Could not connect to the Spotify app."));
    socket.onclose = () =>
      finish(new Error("The Spotify app closed before the command completed."));
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

export async function runSpotifyJavaScript(source: string, port: number): Promise<unknown> {
  let targets: Target[];
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    targets = ((await response.json()) as Target[]).filter(isSpotifyTarget);
  } catch {
    throw new Error(
      `Start Spotify with --remote-debugging-port=${port} before using playlist or bar chords. See the chords-spotify README for setup.`,
    );
  }
  if (targets.length === 0)
    throw new Error("Open the Spotify desktop app before using playlist or bar chords.");

  let target: Target | undefined;
  if (targets.length === 1) target = targets[0];
  else {
    for (const candidate of targets) {
      if (await evaluate(candidate, "document.hasFocus()")) {
        target = candidate;
        break;
      }
    }
  }
  if (!target) throw new Error("Focus the Spotify app before using playlist or bar chords.");
  return evaluate(target, source);
}
