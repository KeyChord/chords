import { expect, test } from "bun:test";
import buildHandler from "../src/js/livesplit-windows";

test("the Windows chord evaluates the layout toggle only on a matching loopback target", async () => {
  const path = new URL("../chords/org/livesplit/one/windows.toml", import.meta.url);
  const bindings = Bun.TOML.parse(await Bun.file(path).text()) as {
    executables: string[];
    on: { livesplit: { file: string } };
    chords: { "v,tm": { "@input:livesplit": ["TOGGLE_MILLISECONDS"] } };
  };
  expect(bindings.executables).toContain("LiveSplit One.exe");
  expect(bindings.on.livesplit.file).toBe("livesplit-windows.js");
  const [action] = bindings.chords["v,tm"]["@input:livesplit"];

  const messages: unknown[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      const url = new URL(request.url);
      if (url.pathname === "/devtools/page/app") {
        if (server.upgrade(request)) return;
        return new Response("Expected a WebSocket", { status: 400 });
      }
      const debuggerURL = `ws://127.0.0.1:${server.port}/devtools/page/app`;
      const target = {
        type: "page",
        title: "LiveSplit One",
        url: "https://tauri.localhost/",
        webSocketDebuggerUrl: debuggerURL,
      };
      return Response.json([
        { ...target, url: "about:blank" },
        { ...target, url: "https://unrelated.example" },
        { ...target, webSocketDebuggerUrl: "ws://example.com/devtools/page/app" },
        target,
      ]);
    },
    websocket: {
      message(socket, value) {
        const message = JSON.parse(String(value));
        messages.push(message);
        socket.send(JSON.stringify({ method: "Runtime.consoleAPICalled" }));
        socket.send(
          JSON.stringify({ id: message.id, result: { result: { value: '{"ok":true}' } } }),
        );
      },
    },
  });
  try {
    expect(await buildHandler(server.port)(action)).toBe(true);
    expect(messages).toEqual([
      {
        id: 1,
        method: "Runtime.evaluate",
        params: {
          expression: expect.stringContaining("TOGGLE_MILLISECONDS"),
          awaitPromise: true,
          returnByValue: true,
        },
      },
    ]);
  } finally {
    await server.stop(true);
  }
});
