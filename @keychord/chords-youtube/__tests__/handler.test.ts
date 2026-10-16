import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  advanceTimersByTimeAsync,
  stubGlobal,
  unstubAllGlobals,
  useFakeTimers,
  useRealTimers,
} from "@keychord/chordtest/test";
import buildHandler from "../src/js/youtube";
import { buildYouTubeJavaScript } from "../src/js/page";

const sockets: FakeSocket[] = [];
let replies: (expression: string, url: string) => unknown;
class FakeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = mock();
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
const fetchMock = mock();
beforeEach(() => {
  sockets.length = 0;
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => [target()] });
  replies = () => ({ id: 1, result: { result: { value: '{"ok":true}' } } });
  stubGlobal("fetch", fetchMock);
  stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  unstubAllGlobals();
  useRealTimers();
});

test("all ten TOML bindings reach the page through the configured handler", async () => {
  // Chord discovers app bindings at chords/<bundle-id segments>/macos.toml.
  const path = new URL(
    "../chords/com/brave/Browser/app/agimnkijcaahngcdmfeangaknmldooml/macos.toml",
    import.meta.url,
  );
  // Use the same TOML parser as the Chord host.
  const bindings = Bun.TOML.parse(await Bun.file(path).text()) as {
    name: string;
    on: { youtube: { file: string } };
    chords: Record<string, unknown>;
  };
  expect(bindings.name).toBe("YouTube");
  expect(bindings.on.youtube.file).toBe("youtube.js");
  const executable = Object.entries(bindings.chords).filter(
    ([, binding]) => "@input:youtube" in (binding as object),
  );
  expect(executable).toHaveLength(10);
  const handler = buildHandler();
  for (const [chord, binding] of executable as [
    string,
    { "@input:youtube": Parameters<typeof handler> },
  ][]) {
    const args = binding["@input:youtube"];
    expect(args).toBeDefined();
    if (chord === "vs(\\d+)") {
      expect(args).toEqual(["SEEK", "$1"]);
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
  await buildHandler(9333)("PAUSE");
  expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:9333/json/list");
});

test.each([0, 65536, -1, 1.5, NaN])("rejects invalid debugging port %s", (port) => {
  expect(() => buildHandler(port)).toThrow("debugging port");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("invalid seeks never contact the browser", async () => {
  await expect(buildHandler()("SEEK", "-1")).rejects.toThrow("non-negative safe integer");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("unavailable debugging gives actionable setup instructions", async () => {
  fetchMock.mockRejectedValue(new Error("Connection refused"));
  await expect(buildHandler()("PLAY")).rejects.toThrow("--remote-debugging-port=9222");
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
  await expect(buildHandler()("PLAY")).rejects.toThrow("Open the YouTube app");
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
  await buildHandler()("MUTE");
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
  await expect(buildHandler()("PLAY")).rejects.toThrow("Focus the YouTube app");
  expect(
    sockets.every((s) => s.requests.every((r) => r.params.expression === "document.hasFocus()")),
  ).toBe(true);
});

test("page failures propagate to Chord", async () => {
  replies = () => ({
    id: 1,
    result: { result: { value: '{"ok":false,"error":"Captions unavailable"}' } },
  });
  await expect(buildHandler()("CAPTIONS")).rejects.toThrow("Captions unavailable");
});

test("protocol failures close the socket and propagate", async () => {
  replies = () => ({ id: 1, error: { message: "Runtime unavailable" } });
  await expect(buildHandler()("PLAY")).rejects.toThrow("Runtime unavailable");
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test("runtime exceptions close the socket and propagate", async () => {
  replies = () => ({
    id: 1,
    result: {
      exceptionDetails: { text: "Uncaught", exception: { description: "Error: player failed" } },
    },
  });
  await expect(buildHandler()("PLAY")).rejects.toThrow("player failed");
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test("a stalled runtime times out and closes its socket", async () => {
  useFakeTimers();
  replies = () => undefined;
  // Bun's `expect(promise).rejects` blocks until the promise settles; capture the error instead.
  const outcome = buildHandler()("PLAY").then(
    () => new Error("expected the stalled runtime to time out"),
    (error: unknown) => error,
  );
  await advanceTimersByTimeAsync(5000);
  expect(((await outcome) as Error).message).toContain("did not respond");
  expect(sockets[0].close).toHaveBeenCalledOnce();
});
