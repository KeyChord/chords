import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import {
  advanceTimersByTimeAsync,
  mocked,
  stubGlobal,
  unstubAllGlobals,
  useFakeTimers,
  useRealTimers,
  waitFor,
} from "@keychord/chordtest/test";
import buildHandler from "../src/js/instagram";
import { buildInstagramJavaScript } from "../src/js/page";
import { configureBraveDebugging } from "../src/js/instagram/browser";

mock.module("../src/js/instagram/browser", () => ({
  configureBraveDebugging: mock(() => Promise.resolve()),
}));

const sockets: FakeSocket[] = [];
type Reply = { id: number; result?: object; error?: object };
let reply: (expression: string, endpoint: string) => Reply | undefined;
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
    const result = reply(request.params.expression, this.url);
    if (result) this.onmessage?.({ data: JSON.stringify(result) });
  }
}
const target = (
  url = "https://www.instagram.com/owner/",
  endpoint = "ws://127.0.0.1:9222/devtools/page/instagram",
) => ({ type: "page", url, webSocketDebuggerUrl: endpoint });
const fetchMock = mock();
beforeEach(() => {
  mocked(configureBraveDebugging).mockReset().mockResolvedValue();
  sockets.length = 0;
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => [target()] });
  reply = () => ({ id: 1, result: { result: { value: '{"ok":true}' } } });
  stubGlobal("fetch", fetchMock);
  stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  mock.restore();
  unstubAllGlobals();
  useRealTimers();
});

test("every TOML chord is wired to the Instagram handler", async () => {
  const bindings = Bun.TOML.parse(
    await Bun.file(
      new URL(
        "../chords/com/brave/Browser/app/akpamiohjfcnimfljfndmaldlcfphjmp/macos.toml",
        import.meta.url,
      ),
    ).text(),
  ) as { on: { instagram: { file: string } }; chords: Record<string, unknown> };
  expect(bindings.on.instagram.file).toBe("instagram.js");
  const chords = Object.entries(bindings.chords).filter(([chord]) => !chord.startsWith("?")) as [
    string,
    { "@input:instagram": Parameters<ReturnType<typeof buildHandler>> },
  ][];
  expect(chords.map(([chord]) => chord)).toEqual([
    "gh",
    "gr",
    "gm",
    "gs",
    "gc",
    "gp",
    "hs.(\\d+)",
    "hsr(\\d+)",
    "pa.",
    "pan",
    "panx",
  ]);
  const handler = buildHandler();
  for (const [chord, binding] of chords) {
    const args = binding["@input:instagram"];
    const replyToStory = chord === "hsr(\\d+)";
    if (chord === "hs.(\\d+)" || replyToStory) {
      expect(args).toEqual([replyToStory ? "STORY_REPLY" : "STORY", "$1"]);
      args[1] = "12";
    } else expect(args).toHaveLength(1);
    await expect(handler(...args)).resolves.toBe(true);
    expect(sockets.at(-1)!.requests[0].params).toEqual({
      expression: buildInstagramJavaScript(args[0], args[1]),
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    expect(sockets.at(-1)!.close).toHaveBeenCalledOnce();
  }
});

test("queued story commands retain their own reply intent", async () => {
  const handler = buildHandler();
  await Promise.all([handler("STORY_REPLY", "2"), handler("STORY", "3")]);
  expect(sockets.map((socket) => socket.requests[0].params.expression)).toEqual([
    buildInstagramJavaScript("STORY_REPLY", "2"),
    buildInstagramJavaScript("STORY", "3"),
  ]);
});

test("invalid story numbers never contact the browser and do not block following chords", async () => {
  const handler = buildHandler();
  await expect(handler("STORY", "0")).rejects.toThrow("positive safe integer");
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(handler("HOME")).resolves.toBe(true);
});

test("a custom local port is supported", async () => {
  await buildHandler(9333)("HOME");
  expect(configureBraveDebugging).toHaveBeenCalledTimes(1);
  expect(configureBraveDebugging).toHaveBeenCalledWith(9333);
  expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:9333/json/list");
});

test.each([0, 65536, -1, 1.5, NaN])("rejects invalid port %s", (port) => {
  expect(() => buildHandler(port)).toThrow("debugging port");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(configureBraveDebugging).not.toHaveBeenCalled();
});

test("chords wait for browser setup and only configure it once", async () => {
  let ready!: () => void;
  mocked(configureBraveDebugging).mockReturnValueOnce(new Promise((resolve) => (ready = resolve)));
  const handler = buildHandler();
  const first = handler("HOME");
  const second = handler("MESSAGES");
  await Promise.resolve();
  expect(fetchMock).not.toHaveBeenCalled();
  ready();
  await expect(first).resolves.toBe(true);
  await expect(second).resolves.toBe(true);
  expect(configureBraveDebugging).toHaveBeenCalledTimes(1);
  expect(configureBraveDebugging).toHaveBeenCalledWith(9222);
});

test("a setup failure is reported without blocking future chords", async () => {
  const error = new Error("Could not terminate Brave");
  const log = spyOn(console, "error").mockImplementation(() => undefined);
  mocked(configureBraveDebugging).mockRejectedValueOnce(error);
  const handler = buildHandler();
  await expect(handler("HOME")).rejects.toThrow(error.message);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith("Could not enable Brave debugging:", error);
  await expect(handler("HOME")).resolves.toBe(true);
});

test("an unavailable browser reports its required setup", async () => {
  fetchMock.mockRejectedValue(new Error("Connection refused"));
  await expect(buildHandler()("HOME")).rejects.toThrow("--remote-debugging-port=9222");
});

test("workers, unrelated pages, and lookalike domains never receive actions", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [
      target("https://instagram.com.example.com"),
      target("https://example.com"),
      { ...target(), type: "service_worker" },
      target("not a URL"),
    ],
  });
  await expect(buildHandler()("HOME")).rejects.toThrow("Open the Instagram app");
  expect(sockets).toHaveLength(0);
});

test("multiple Instagram pages route only to the focused page", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [target(undefined, "ws://background"), target(undefined, "ws://focused")],
  });
  reply = (expression, endpoint) => ({
    id: 1,
    result: {
      result: {
        value: expression === "document.hasFocus()" ? endpoint === "ws://focused" : '{"ok":true}',
      },
    },
  });
  await buildHandler()("NOTE");
  expect(sockets.map((socket) => socket.url)).toEqual([
    "ws://background",
    "ws://focused",
    "ws://focused",
  ]);
  expect(sockets[0].requests).toHaveLength(1);
  expect(sockets.every((socket) => socket.close.mock.calls.length === 1)).toBe(true);
});

test("multiple unfocused Instagram pages are left untouched", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [target(), target(undefined, "ws://other")],
  });
  reply = () => ({ id: 1, result: { result: { value: false } } });
  await expect(buildHandler()("NOTE")).rejects.toThrow("Focus the Instagram app");
  expect(
    sockets.every((socket) =>
      socket.requests.every((request) => request.params.expression === "document.hasFocus()"),
    ),
  ).toBe(true);
});

test("page errors propagate and a following chord can still run", async () => {
  const handler = buildHandler();
  reply = () => ({
    id: 1,
    result: { result: { value: '{"ok":false,"error":"Notes unavailable"}' } },
  });
  await expect(handler("NOTE")).rejects.toThrow("Notes unavailable");
  reply = () => ({ id: 1, result: { result: { value: '{"ok":true}' } } });
  await expect(handler("HOME")).resolves.toBe(true);
});

test("quickly entered chords complete in order", async () => {
  const handler = buildHandler();
  reply = () => undefined;
  const first = handler("NOTE");
  const second = handler("CLOSE_NOTE");
  await waitFor(() => expect(sockets).toHaveLength(1));
  reply = () => ({ id: 1, result: { result: { value: '{"ok":true}' } } });
  sockets[0].onmessage?.({ data: JSON.stringify(reply("", "")) });
  await expect(first).resolves.toBe(true);
  await expect(second).resolves.toBe(true);
  expect(sockets).toHaveLength(2);
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test.each([
  { id: 1, error: { message: "Runtime unavailable" } },
  {
    id: 1,
    result: {
      exceptionDetails: { text: "Uncaught", exception: { description: "Runtime unavailable" } },
    },
  },
])("protocol and runtime errors close their sockets", async (response) => {
  reply = () => response;
  await expect(buildHandler()("HOME")).rejects.toThrow("Runtime unavailable");
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test("a stalled page times out and closes its socket", async () => {
  useFakeTimers();
  reply = () => undefined;
  const pending = buildHandler()("HOME");
  // Bun's `expect(promise).rejects` blocks until the promise settles; capture the error instead.
  const failure = pending.then(
    () => undefined,
    (error: unknown) => error,
  );
  await advanceTimersByTimeAsync(10_000);
  const error = await failure;
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain("did not respond");
  expect(sockets[0].close).toHaveBeenCalledOnce();
});
