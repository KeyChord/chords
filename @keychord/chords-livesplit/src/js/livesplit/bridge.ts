export type BridgeOptions = {
  /** Executable name of the LiveSplit One process. */
  processName: string;
  /** Absolute path of the bridge dylib to load into LiveSplit One. */
  library: string;
};

type Output = { exitCode: number | null; stdout: string; stderr: string };
type BridgeResponse = { ok: boolean; value?: unknown; error?: string };

const RESPONSE_TIMEOUT = 5000;
// Attaching reads LiveSplit One's symbols; the app stays paused until lldb detaches.
const LOAD_TIMEOUT = 60_000;

async function run(command: string[], timeout = 5000): Promise<Output> {
  const child = Bun.spawn(command, { stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode: child.signalCode ? null : exitCode, stdout, stderr };
}

async function findProcess(processName: string): Promise<number> {
  // `comm` is the full executable path on macOS, so long names are not truncated.
  const { exitCode, stdout, stderr } = await run(["/bin/ps", "-axo", "pid=,comm="]);
  if (exitCode !== 0) throw new Error(stderr.trim() || "Could not list running processes.");
  const pids = stdout
    .split("\n")
    .map((line) => /^\s*(\d+)\s+(.+)$/.exec(line))
    .filter((match) => match && match[2]!.split("/").pop() === processName)
    .map((match) => Number(match![1]));
  if (pids.length === 0) throw new Error(`Open ${processName} before using LiveSplit chords.`);
  if (pids.length > 1) throw new Error(`Close extra ${processName} instances first.`);
  return pids[0]!;
}

// The bridge places its socket in the per-user temporary directory, which $TMPDIR may not name.
async function socketPath(pid: number): Promise<string> {
  const { exitCode, stdout } = await run(["/usr/bin/getconf", "DARWIN_USER_TEMP_DIR"]);
  const directory = stdout.trim().replace(/\/$/, "");
  if (exitCode !== 0 || !directory)
    throw new Error("Could not find the user's temporary directory.");
  return `${directory}/keychord-livesplit-${pid}.sock`;
}

class BridgeUnavailableError extends Error {}

function request(path: string, body: string): Promise<BridgeResponse> {
  return new Promise((resolve, reject) => {
    let pending = Buffer.from(`${JSON.stringify({ body })}\n`);
    let text = "";
    const decoder = new TextDecoder();
    let settled = false;
    let connection: { end(): void } | undefined;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      connection?.end();
      if (error) return reject(error);
      try {
        resolve(JSON.parse(text) as BridgeResponse);
      } catch {
        reject(new Error("LiveSplit One closed the bridge connection without a response."));
      }
    };
    const timer = setTimeout(
      () => finish(new Error("LiveSplit One did not respond to the command.")),
      RESPONSE_TIMEOUT,
    );
    // Unix sockets have small send buffers; write the rest of the request as it drains.
    const flush = (socket: { write(data: Uint8Array): number }) => {
      const written = socket.write(pending);
      if (written > 0) pending = pending.subarray(written);
    };
    const unavailable = (error: Error & { code?: string }) =>
      finish(
        error.code === "ENOENT" || error.code === "ECONNREFUSED"
          ? new BridgeUnavailableError(error.message)
          : error,
      );
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
        connectError: (_socket, error) => unavailable(error),
      },
    }).catch(unavailable);
  });
}

function lldbString(value: string): string {
  return `"${value.replace(/[\\"]/g, "\\$&")}"`;
}

async function loadBridge(pid: number, { processName, library }: BridgeOptions): Promise<void> {
  if (!(await Bun.file(library).exists())) {
    throw new Error(
      `The LiveSplit bridge is missing at ${library}. Run \`vp run build:bridge\` in @keychord/chords-livesplit.`,
    );
  }
  if ((await run(["/usr/bin/xcode-select", "-p"])).exitCode !== 0) {
    throw new Error(
      `Loading the bridge into a running ${processName} needs lldb. Install the Xcode Command Line Tools with \`xcode-select --install\`, or start ${processName} with DYLD_INSERT_LIBRARIES as described in the chords-livesplit README.`,
    );
  }
  const output = await run(
    [
      "/usr/bin/lldb",
      "--no-lldbinit",
      "--batch",
      "--attach-pid",
      String(pid),
      "--one-line",
      `process load ${lldbString(library)}`,
      "--one-line",
      "process detach",
    ],
    LOAD_TIMEOUT,
  );
  // lldb exits successfully even when a batch command fails, so the caller checks the socket.
  const errors = `${output.stdout}\n${output.stderr}`
    .split("\n")
    .filter((line) => /^error:/i.test(line.trim()))
    .join(" ");
  if (output.exitCode === null) {
    throw new Error(`lldb timed out while loading the bridge into ${processName}.`);
  }
  if (errors) throw new Error(`Could not load the bridge into ${processName}: ${errors}`);
}

/**
 * Runs an async function body in LiveSplit One's web view and returns its result. The first call
 * for a LiveSplit One process loads the bridge into it with lldb.
 */
export async function runLiveSplitJavaScript(
  body: string,
  options: BridgeOptions,
): Promise<unknown> {
  const pid = await findProcess(options.processName);
  const path = await socketPath(pid);
  let response: BridgeResponse;
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
  if (!response.ok)
    throw new Error(response.error ?? `${options.processName} rejected the command.`);
  return response.value;
}
