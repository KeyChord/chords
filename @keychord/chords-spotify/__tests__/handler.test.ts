import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import {
  advanceTimersByTimeAsync,
  stubGlobal,
  unstubAllGlobals,
  useFakeTimers,
  useRealTimers,
  waitFor,
} from "@keychord/chordtest/test";
import { buildSpotifyJavaScript } from "../src/js/page";

const configureSpotifyDebugging = mock((_port: number) => Promise.resolve());
mock.module("../src/js/spotify/app", () => ({ configureSpotifyDebugging }));
// The real app module imports the host `chord` module; import the handler after mocking it.
const { default: buildHandler } = await import("../src/js/spotify");

const sockets: FakeSocket[] = [];
let replies: (expression: string, url: string) => unknown;
class FakeSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = mock();
  requests: { method: string; params: { expression: string } }[] = [];
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
  url = "https://xpui.app.spotify.com/index.html",
  endpoint = "ws://127.0.0.1:9223/devtools/page/spotify",
) {
  return { type: "page", url, webSocketDebuggerUrl: endpoint };
}
const fetchMock = mock();
beforeEach(() => {
  configureSpotifyDebugging.mockReset().mockResolvedValue(undefined);
  sockets.length = 0;
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => [target()] });
  replies = () => ({ id: 1, result: { result: { value: '{"ok":true}' } } });
  stubGlobal("fetch", fetchMock);
  stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => {
  mock.restore();
  unstubAllGlobals();
  useRealTimers();
});

test("all TOML chords dispatch their intended Spotify action and argument", async () => {
  // Chord discovers app bindings at chords/<bundle-id segments>/macos.toml.
  const path = new URL("../chords/com/spotify/client/macos.toml", import.meta.url);
  // Chord uses Bun's TOML parser, so validate the actual host format.
  const bindings = Bun.TOML.parse(await Bun.file(path).text()) as {
    name: string;
    on: unknown;
    chords: Record<string, unknown>;
  };
  expect(bindings.name).toBe("Spotify");
  expect(bindings.on).toEqual({ spotify: { file: "spotify.js" } });
  // Group headings have no action and are not regular-expression triggers.
  const actionBindings = Object.entries(bindings.chords).filter(
    ([, binding]) => "@input:spotify" in (binding as Record<string, unknown>),
  );
  expect(actionBindings).toHaveLength(32);
  expect(bindings.chords["?b"]).toEqual({ name: "Bar (Player)" });
  expect(bindings.chords["?bs"]).toEqual({ name: "Bar: Shuffle / Scrub" });
  expect(bindings.chords["?np"]).toEqual({ name: "Now Playing" });
  const expected = {
    gls: "LIKED_SONGS",
    pm5: "MORE",
    pr5: "REMOVE",
    pa5: "QUEUE",
    pe5: "EXCLUDE",
    psj5: "JAM",
    pgsr5: "SONG_RADIO",
    pgar5: "ARTIST",
    pgal5: "ALBUM",
    pvc5: "CREDITS",
    psc5: "COPY_LINK",
    pse5: "EMBED",
    "b[": "BAR_PREVIOUS",
    "b]": "BAR_NEXT",
    bp: "BAR_PLAY",
    bh: "BAR_HALT",
    br: "BAR_REPEAT",
    bl: "BAR_LYRICS",
    bq: "BAR_QUEUE",
    bc: "BAR_CONNECT",
    bm: "BAR_MINIPLAYER",
    bf: "BAR_FULLSCREEN",
    bs: "BAR_SHUFFLE",
    bs37: "BAR_SCRUB",
    npv: "NP_TOGGLE",
    npx: "NP_HIDE",
    npf: "NP_EXPAND",
    npm: "NP_MINIMIZE",
    npa: "NP_ARTWORK",
    npc: "NP_CANVAS",
    npi: "NP_ARTIST_IMAGE",
    npl: "NP_LYRICS",
  };
  // Chord treats ordinary key sequences literally; only parenthesized groups are regex.
  const matches = (pattern: string, chord: string) =>
    pattern.includes("(") ? new RegExp("^(?:" + pattern + ")$").test(chord) : pattern === chord;
  const handler = buildHandler();
  for (const [chord, action] of Object.entries(expected)) {
    const matched = actionBindings.filter(([pattern]) => matches(pattern, chord));
    expect(matched).toHaveLength(1);
    const [pattern, binding] = matched[0] as [
      string,
      { "@input:spotify": Parameters<typeof handler> },
    ];
    const args = binding["@input:spotify"];
    const numbered = pattern.includes("(");
    expect(args).toEqual(numbered ? [action, "$1"] : [action]);
    const captures = numbered ? new RegExp("^(?:" + pattern + ")$").exec(chord)! : [];
    const resolved = args.map((arg) => (arg === "$1" ? captures[1] : arg)) as Parameters<
      typeof handler
    >;
    await expect(handler(...resolved)).resolves.toBe(true);
    expect(sockets.at(-1)!.requests[0]).toEqual({
      id: 1,
      method: "Runtime.evaluate",
      params: {
        expression: buildSpotifyJavaScript(...resolved),
        returnByValue: true,
        awaitPromise: true,
        userGesture: true,
      },
    });
    expect(sockets.at(-1)!.close).toHaveBeenCalledOnce();
  }
});

test("supports a configured debugging port", async () => {
  await buildHandler(9333)("MORE", "1");
  expect(configureSpotifyDebugging).toHaveBeenCalledTimes(1);
  expect(configureSpotifyDebugging).toHaveBeenCalledWith(9333);
  expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:9333/json/list");
});

test.each([0, 65536, -1, 1.5, NaN])("rejects invalid debugging port %s", (port) => {
  expect(() => buildHandler(port)).toThrow("debugging port");
  expect(configureSpotifyDebugging).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("chords wait for Spotify setup and only configure it once", async () => {
  let finishSetup!: () => void;
  configureSpotifyDebugging.mockReturnValueOnce(
    new Promise((resolve) => {
      finishSetup = resolve;
    }),
  );
  const handler = buildHandler();
  const pending = handler("MORE", "1");
  await Promise.resolve();
  expect(fetchMock).not.toHaveBeenCalled();
  finishSetup();
  await expect(pending).resolves.toBe(true);
  await expect(handler("QUEUE", "2")).resolves.toBe(true);
  expect(configureSpotifyDebugging).toHaveBeenCalledTimes(1);
  expect(configureSpotifyDebugging).toHaveBeenCalledWith(9223);
});

test("a setup failure is reported without blocking future chords", async () => {
  const error = new Error("Permission denied");
  const log = spyOn(console, "error").mockImplementation(() => undefined);
  configureSpotifyDebugging.mockRejectedValueOnce(error);
  const handler = buildHandler();
  await expect(handler("MORE", "1")).rejects.toThrow("Permission denied");
  expect(log).toHaveBeenCalledWith("Could not enable Spotify debugging:", error);
  expect(fetchMock).not.toHaveBeenCalled();
  await expect(handler("QUEUE", "2")).resolves.toBe(true);
});

test("invalid track numbers and actions never contact Spotify", async () => {
  await expect(buildHandler()("REMOVE", "0")).rejects.toThrow("positive safe integer");
  await expect(buildHandler()("unknown" as "REMOVE", "1")).rejects.toThrow(
    "Unknown Spotify action",
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("invalid scrub times never contact Spotify", async () => {
  for (const seconds of [undefined, "", "-1", "1.5", "1);alert(1)//", Infinity]) {
    await expect(buildHandler()("BAR_SCRUB", seconds)).rejects.toThrow("non-negative safe integer");
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

test("unavailable debugging gives Spotify setup instructions", async () => {
  fetchMock.mockRejectedValue(new Error("Connection refused"));
  await expect(buildHandler()("MORE", "1")).rejects.toThrow("--remote-debugging-port=9223");
});

test.each([
  { ok: false, status: 500 },
  { ok: true, json: async () => ({ unexpected: true }) },
])("invalid discovery responses give setup instructions", async (response) => {
  fetchMock.mockResolvedValue(response);
  await expect(buildHandler()("MORE", "1")).rejects.toThrow("chords-spotify README");
});

test("web players, unrelated pages, workers, and lookalike domains are excluded", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [
      target("https://open.spotify.com/playlist/test"),
      target("https://example.com"),
      target("https://xpui.app.spotify.com.example.com"),
      target("not a URL"),
      { ...target(), type: "service_worker" },
      { type: "page", url: target().url },
    ],
  });
  await expect(buildHandler()("MORE", "1")).rejects.toThrow("Open the Spotify desktop app");
  expect(sockets).toHaveLength(0);
});

test("several Spotify pages route only to the focused one", async () => {
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
  await buildHandler()("CREDITS", "5");
  expect(sockets.map((socket) => socket.url)).toEqual([
    "ws://first",
    "ws://focused",
    "ws://focused",
  ]);
  expect(sockets.every((socket) => socket.close.mock.calls.length === 1)).toBe(true);
});

test("multiple unfocused pages do not receive an action", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => [target(), target(undefined, "ws://second")],
  });
  replies = () => ({ id: 1, result: { result: { value: false } } });
  await expect(buildHandler()("REMOVE", "1")).rejects.toThrow("Focus the Spotify app");
  expect(
    sockets.every((socket) =>
      socket.requests.every((request) => request.params.expression === "document.hasFocus()"),
    ),
  ).toBe(true);
});

test("page failures propagate and the next chord still runs", async () => {
  const handler = buildHandler();
  replies = () => ({
    id: 1,
    result: { result: { value: '{"ok":false,"error":"Track is unavailable"}' } },
  });
  await expect(handler("QUEUE", "1")).rejects.toThrow("Track is unavailable");
  replies = () => ({ id: 1, result: { result: { value: '{"ok":true}' } } });
  await expect(handler("MORE", "2")).resolves.toBe(true);
});

test.each([
  [{ id: 1, error: { message: "Runtime unavailable" } }, "Runtime unavailable"],
  [
    {
      id: 1,
      result: {
        exceptionDetails: { text: "Uncaught", exception: { description: "Error: menu failed" } },
      },
    },
    "menu failed",
  ],
])("protocol errors close the socket and propagate", async (reply, message) => {
  replies = () => reply;
  await expect(buildHandler()("MORE", "1")).rejects.toThrow(message as string);
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test.each(["error", "close"])("socket %s events close the socket and reject", async (event) => {
  replies = () => {
    queueMicrotask(() => (event === "error" ? sockets[0].onerror?.() : sockets[0].onclose?.()));
  };
  await expect(buildHandler()("MORE", "1")).rejects.toThrow(
    event === "error" ? "Could not connect" : "closed before",
  );
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test("malformed protocol messages reject and clean up", async () => {
  replies = () => {
    queueMicrotask(() => sockets[0].onmessage?.({ data: "invalid JSON" }));
  };
  await expect(buildHandler()("MORE", "1")).rejects.toThrow();
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test("a stalled runtime times out and closes its socket", async () => {
  useFakeTimers();
  replies = () => undefined;
  // Bun's `expect(promise).rejects` blocks until the promise settles; capture the error instead.
  const outcome = buildHandler()("MORE", "1").then(
    () => new Error("expected the stalled runtime to time out"),
    (error: unknown) => error,
  );
  await advanceTimersByTimeAsync(5000);
  expect(((await outcome) as Error).message).toContain("did not respond");
  expect(sockets[0].close).toHaveBeenCalledOnce();
});

test("overlapping chords wait for the previous menu action to finish", async () => {
  replies = () => undefined;
  const handler = buildHandler();
  const first = handler("QUEUE", "1");
  const second = handler("REMOVE", "2");
  await waitFor(() => expect(sockets).toHaveLength(1));
  const result = { data: JSON.stringify({ id: 1, result: { result: { value: '{"ok":true}' } } }) };
  sockets[0].onmessage?.(result);
  await first;
  await waitFor(() => expect(sockets).toHaveLength(2));
  expect(sockets[1].requests[0].params.expression).toBe(buildSpotifyJavaScript("REMOVE", "2"));
  sockets[1].onmessage?.(result);
  await second;
});

test("Liked Songs uses the configured renderer and reports missing debugging", async () => {
  fetchMock.mockRejectedValue(new Error("Connection refused"));
  await expect(buildHandler(9333)("LIKED_SONGS")).rejects.toThrow("--remote-debugging-port=9333");
});

test("the next playlist chord waits for Liked Songs navigation to finish", async () => {
  replies = () => undefined;
  const handler = buildHandler();
  const first = handler("LIKED_SONGS");
  const second = handler("MORE", "1");
  await waitFor(() => expect(sockets).toHaveLength(1));
  const result = { data: JSON.stringify({ id: 1, result: { result: { value: '{"ok":true}' } } }) };
  sockets[0].onmessage?.(result);
  await first;
  await waitFor(() => expect(sockets).toHaveLength(2));
  expect(sockets[1].requests[0].params.expression).toBe(buildSpotifyJavaScript("MORE", "1"));
  sockets[1].onmessage?.(result);
  await second;
});
