import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLiveSplitJavaScript } from "../src/js/livesplit/bridge";

type Bridge = { stop(force?: boolean): void };
type Reply = (request: { body: string }) => string | undefined;

const library = import.meta.path;
const options = { processName: "LiveSplit One", library };
let directory: string;
let processes: string;
let bridge: Bridge | undefined;
let requests: { body: string }[];
let reply: Reply;
let onLoad: () => void;
let lldbOutput: { exitCode: number; stdout: string; signalCode?: string };
let developerTools: boolean;

// Accepts one JSON line per connection, like the injected Objective-C bridge.
function startBridge(pid = 42) {
  let buffered = "";
  bridge = Bun.listen({
    unix: join(directory, `keychord-livesplit-${pid}.sock`),
    socket: {
      data(socket, data) {
        buffered += Buffer.from(data).toString();
        const newline = buffered.indexOf("\n");
        if (newline < 0) return;
        const request = JSON.parse(buffered.slice(0, newline)) as { body: string };
        buffered = "";
        requests.push(request);
        const response = reply(request);
        if (response !== undefined) socket.write(response);
        socket.end();
      },
    },
  });
}

const spawn = mock((command: string[]) => {
  let stdout = "";
  let exitCode = 0;
  let signalCode: string | null = null;
  if (command[0] === "/bin/ps") stdout = processes;
  else if (command[0] === "/usr/bin/getconf") stdout = `${directory}/\n`;
  else if (command[0] === "/usr/bin/xcode-select") exitCode = developerTools ? 0 : 2;
  else if (command[0] === "/usr/bin/lldb") {
    onLoad();
    ({ exitCode, stdout } = lldbOutput);
    signalCode = lldbOutput.signalCode ?? null;
  }
  return {
    exited: Promise.resolve(exitCode),
    signalCode,
    stdout: new Response(stdout).body,
    stderr: new Response("").body,
  };
});
const commands = () => spawn.mock.calls.map(([command]) => command);
const lldbCalls = () => commands().filter(([program]) => program === "/usr/bin/lldb");

beforeEach(() => {
  mock.clearAllMocks();
  spyOn(Bun, "spawn").mockImplementation(spawn as unknown as typeof Bun.spawn);
  directory = mkdtempSync(join(tmpdir(), "livesplit-"));
  processes =
    "    1 /sbin/launchd\n   42 /Applications/LiveSplit One\n   77 /Applications/LiveSplit One Helper\n";
  requests = [];
  reply = () => '{"ok":true,"value":"{\\"ok\\":true}"}\n';
  onLoad = () => startBridge();
  lldbOutput = {
    exitCode: 0,
    stdout: '(lldb) process load "/x"\nLoading "/x"...ok\nImage 0 loaded.\n',
  };
  developerTools = true;
});
afterEach(() => {
  bridge?.stop(true);
  bridge = undefined;
  rmSync(directory, { recursive: true, force: true });
  mock.restore();
});

test("runs JavaScript through an already loaded bridge without attaching lldb", async () => {
  startBridge();
  expect(await runLiveSplitJavaScript("return 1", options)).toBe('{"ok":true}');
  expect(requests).toEqual([{ body: "return 1" }]);
  expect(lldbCalls()).toEqual([]);
});

test("loads the bridge into the running process with lldb, then retries", async () => {
  const path = join(directory, 'odd "dir"', "bridge.dylib");
  expect(await runLiveSplitJavaScript("return 1", { ...options, library })).toBe('{"ok":true}');
  expect(lldbCalls()).toEqual([
    [
      "/usr/bin/lldb",
      "--no-lldbinit",
      "--batch",
      "--attach-pid",
      "42",
      "--one-line",
      `process load "${library}"`,
      "--one-line",
      "process detach",
    ],
  ]);
  expect(requests).toHaveLength(1);
  // Quotes and backslashes in the library path are escaped for lldb's command parser.
  bridge?.stop(true);
  bridge = undefined;
  await Bun.write(path, "");
  await runLiveSplitJavaScript("return 1", { ...options, library: path });
  expect(lldbCalls()[1]![6]).toBe(`process load "${path.replace(/"/g, '\\"')}"`);
});

test("delivers request bodies larger than the socket buffer", async () => {
  startBridge();
  const body = `return ${JSON.stringify("x".repeat(256 * 1024))}.length`;
  await runLiveSplitJavaScript(body, options);
  expect(requests).toEqual([{ body }]);
});

test("reports JavaScript errors from the bridge", async () => {
  startBridge();
  reply = () => '{"ok":false,"error":"TypeError: boom"}\n';
  await expect(runLiveSplitJavaScript("throw 1", options)).rejects.toThrow("TypeError: boom");
});

test("reports a bridge that closes without answering", async () => {
  startBridge();
  reply = () => undefined;
  await expect(runLiveSplitJavaScript("return 1", options)).rejects.toThrow(
    "LiveSplit One closed the bridge connection without a response.",
  );
});

test("matches the executable name exactly", async () => {
  processes = "   77 /Applications/LiveSplit One Helper\n";
  await expect(runLiveSplitJavaScript("return 1", options)).rejects.toThrow(
    "Open LiveSplit One before using LiveSplit chords.",
  );
  processes = "   42 /Applications/LiveSplit One\n   43 /Users/me/LiveSplit One\n";
  await expect(runLiveSplitJavaScript("return 1", options)).rejects.toThrow(
    "Close extra LiveSplit One instances first.",
  );
  processes = "   51 /tmp/LSO Test\n";
  startBridge(51);
  expect(await runLiveSplitJavaScript("return 1", { ...options, processName: "LSO Test" })).toBe(
    '{"ok":true}',
  );
});

test("does not attach lldb without the bridge library or developer tools", async () => {
  const missing = join(directory, "missing.dylib");
  await expect(
    runLiveSplitJavaScript("return 1", { ...options, library: missing }),
  ).rejects.toThrow(`The LiveSplit bridge is missing at ${missing}.`);
  developerTools = false;
  await expect(runLiveSplitJavaScript("return 1", options)).rejects.toThrow(
    "Loading the bridge into a running LiveSplit One needs lldb.",
  );
  expect(lldbCalls()).toEqual([]);
});

test("reports lldb failures and a bridge that never starts", async () => {
  onLoad = () => {};
  lldbOutput = { exitCode: 0, stdout: "error: attach failed: Not allowed to attach to process.\n" };
  await expect(runLiveSplitJavaScript("return 1", options)).rejects.toThrow(
    "Could not load the bridge into LiveSplit One: error: attach failed: Not allowed to attach to process.",
  );
  lldbOutput = { exitCode: 0, stdout: "Image 0 loaded.\n" };
  await expect(runLiveSplitJavaScript("return 1", options)).rejects.toThrow(
    "The bridge did not start in LiveSplit One.",
  );
  lldbOutput = { exitCode: 143, stdout: "", signalCode: "SIGTERM" };
  await expect(runLiveSplitJavaScript("return 1", options)).rejects.toThrow(
    "lldb timed out while loading the bridge into LiveSplit One.",
  );
});
