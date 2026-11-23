import { expect, test } from "bun:test";
import buildHandler from "../src/js/livesplit-linux";

const LIVE_SPLIT_ORIGIN = "https://one.livesplit.org";

test("the Linux chord requires the app window and guards the timer's origin and focus", async () => {
  const file = new URL("../chords/org/livesplit/one/linux.toml", import.meta.url);
  const bindings = Bun.TOML.parse(await Bun.file(file).text()) as {
    executables: string[];
    on: { livesplit: { file: string } };
    chords: { "v,tm": { "@input:livesplit": ["TOGGLE_MILLISECONDS"] } };
  };
  expect(bindings.executables).toEqual(["keychord-livesplit"]);
  expect(bindings.on.livesplit.file).toBe("livesplit-linux.js");
  const [action] = bindings.chords["v,tm"]["@input:livesplit"];

  let origin = LIVE_SPLIT_ORIGIN;
  let focused = true;
  let requests = 0;
  const expressions: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      const url = new URL(request.url);
      if (url.pathname === "/devtools/page/timer") {
        if (server.upgrade(request)) return;
        return new Response("Expected a WebSocket", { status: 400 });
      }

      requests++;
      const target = {
        type: "page",
        title: "LiveSplit One",
        url: LIVE_SPLIT_ORIGIN,
        webSocketDebuggerUrl: `ws://127.0.0.1:${server.port}/devtools/page/timer`,
      };
      return Response.json([
        { ...target, url: "https://tauri.localhost/" },
        { ...target, url: "https://one.livesplit.org.example/" },
        { ...target, webSocketDebuggerUrl: "ws://example.com/devtools/page/timer" },
        target,
      ]);
    },
    websocket: {
      async message(socket, value) {
        const message = JSON.parse(String(value));
        const expression = message.params.expression as string;
        expressions.push(expression);
        // Run the emitted focus/origin guard and observe whether it reaches the layout lookup.
        const evaluate = new Function("location", "document", `return ${expression}`);
        const document = { hasFocus: () => focused, getElementById: () => null };
        try {
          const result = JSON.parse(await evaluate({ origin }, document));
          expect(result.error).toBe("LiveSplit One has not finished loading.");
          socket.send(
            JSON.stringify({ id: message.id, result: { result: { value: '{"ok":true}' } } }),
          );
        } catch (error) {
          socket.send(
            JSON.stringify({
              id: message.id,
              result: { exceptionDetails: { text: (error as Error).message } },
            }),
          );
        }
      },
    },
  });
  try {
    const handler = buildHandler(server.port);
    expect(() => handler.call({ focusedAppId: "com.google.Chrome" }, action)).toThrow("Focus");
    expect(requests).toBe(0);

    const timer = { focusedAppId: "org.livesplit.one" };
    expect(await handler.call(timer, action)).toBe(true);
    expect(expressions).toHaveLength(1);
    expect(expressions[0]).toContain("TOGGLE_MILLISECONDS");

    focused = false;
    await expect(handler.call(timer, action)).rejects.toThrow("Focus");
    focused = true;
    origin = "https://unrelated.example";
    await expect(handler.call(timer, action)).rejects.toThrow("Focus");
  } finally {
    await server.stop(true);
  }
});
