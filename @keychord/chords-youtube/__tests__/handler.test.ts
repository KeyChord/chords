import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import buildHandler from "../src/js/youtube";
import { buildYouTubeJavaScript } from "../src/js/page";

const sockets: FakeSocket[] = [];
let replies: (expression: string, url: string) => unknown;
class FakeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
  requests: {
    method: string;
    params: { expression: string; userGesture: boolean; awaitPromise: boolean };
  }[] = [];
  constructor(readonly url: string) {
    sockets.push(this);
    queueMicrotask(() => this.onopen?.());
  }
  send(value: string) {
    const request = JSON.parse(value);
    this.requests.push(request);
    this.onmessage?.({ data: JSON.stringify({ method: "Runtime.consoleAPICalled" }) });
    const reply = replies(request.params.expression, this.url);
    if (reply !== undefined) this.onmessage?.({ data: JSON.stringify(reply) });
  }
}

function target(
  url = "https://www.youtube.com/watch?v=test",
  endpoint = "ws://127.0.0.1:9222/devtools/page/youtube",
) {
  return { type: "page", url, webSocketDebuggerUrl: endpoint };
}
const fetchMock = vi.fn();
beforeEach(() => {
  sockets.length = 0;
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => [target()] });
  replies = () => ({ id: 1, result: { result: { value: '{"ok":true}' } } });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("all ten TOML bindings reach the page through the configured handler", async () => {
  // Chord discovers app bindings at chords/<bundle-id segments>/macos.toml.
  const path = new URL(
    "../chords/com/brave/Browser/app/agimnkijcaahngcdmfeangaknmldooml/macos.toml",
    import.meta.url,
  );
  // Use the same TOML parser as the Chord host.
  const bindings = JSON.parse(
    execFileSync(
      "bun",
      ["-e", "console.log(JSON.stringify(Bun.TOML.parse(await Bun.stdin.text())))"],
      {
        input: readFileSync(path, "utf8"),
        encoding: "utf8",
      },
    ),
  );
  expect(bindings.name).toBe("YouTube");
  expect(bindings.on.youtube.file).toBe("youtube.js");
  expect(Object.keys(bindings.chords)).toHaveLength(10);
  const handler = buildHandler();
  for (const [chord, binding] of Object.entries(bindings.chords) as [
    string,
    { "@input:youtube": Parameters<typeof handler> },
  ][]) {
    const args = binding["@input:youtube"];
    expect(args).toBeDefined();
    if (chord === "vs(\\d+)") {
      expect(args).toEqual(["seek", "$1"]);
      args[1] = "30";
    }
    await expect(handler(...args)).resolves.toBe(true);
    expect(sockets.at(-1)!.requests[0].params).toEqual({
      expression: buildYouTubeJavaScript(...args),
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    expect(sockets.at(-1)!.close).toHaveBeenCalledOnce();
  }
});

test("the handler supports a configured local debugging port", async () => {
  await buildHandler(9333)("pause");
  expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:9333/json/list");
});

test.each([0, 65536, -1, 1.5, NaN])("rejects invalid debugging port %s", (port) => {
  expect(() => buildHandler(port)).toThrow("debugging port");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("invalid seeks never contact the browser", async () => {
  await expect(buildHandler()("seek", "-1")).rejects.toThrow("non-negative safe integer");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("unavailable debugging gives actionable setup instructions", async () => {
  fetchMock.mockRejectedValue(new Error("Connection refused"));
  await expect(buildHandler()("play")).rejects.toThrow("--remote-debugging-port=9222");
});

test("non-YouTube pages, workers, and lookalike domains are excluded", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [
      target("https://example.com"),
      target("https://youtube.com.example.com"),
      { ...target(), type: "service_worker" },
      target("not a URL"),
    ],
  });
  await expect(buildHandler()("play")).rejects.toThrow("Open the YouTube app");
  expect(sockets).toHaveLength(0);
});

test("several YouTube pages route the action only to the focused one", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [target(undefined, "ws://first"), target(undefined, "ws://focused")],
  });
  replies = (expression, url) => ({
    id: 1,
    result: {
      result: {
        value: expression === "document.hasFocus()" ? url === "ws://focused" : '{"ok":true}',
      },
    },
  });
  await buildHandler()("mute");
  expect(sockets.map((s) => s.url)).toEqual(["ws://first", "ws://focused", "ws://focused"]);
  expect(sockets[0].requests).toHaveLength(1);
  expect(sockets.every((s) => s.close.mock.calls.length === 1)).toBe(true);
});

test("multiple unfocused pages do not receive a command", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [target(), target(undefined, "ws://second")],
  });
  replies = () => ({ id: 1, result: { result: { value: false } } });
  await expect(buildHandler()("play")).rejects.toThrow("Focus the YouTube app");
  expect(
    sockets.every((s) => s.requests.every((r) => r.params.expression === "document.hasFocus()")),
  ).toBe(true);
});

test("page failures propagate to Chord", async () => {
  replies = () => ({
    id: 1,
    result: { result: { value: '{"ok":false,"error":"Captions unavailable"}' } },
  });
  await expect(buildHandler()("captions")).rejects.toThrow("Captions unavailable");
});

test("protocol failures close the socket and propagate", async () => {
  replies = () => ({ id: 1, error: { message: "Runtime unavailable" } });
  await expect(buildHandler()("play")).rejects.toThrow("Runtime unavailable");
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test("runtime exceptions close the socket and propagate", async () => {
  replies = () => ({
    id: 1,
    result: {
      exceptionDetails: { text: "Uncaught", exception: { description: "Error: player failed" } },
    },
  });
  await expect(buildHandler()("play")).rejects.toThrow("player failed");
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test("a stalled runtime times out and closes its socket", async () => {
  vi.useFakeTimers();
  replies = () => undefined;
  const pending = buildHandler()("play");
  const assertion = expect(pending).rejects.toThrow("did not respond");
  await vi.advanceTimersByTimeAsync(5000);
  await assertion;
  expect(sockets[0].close).toHaveBeenCalledOnce();
});
