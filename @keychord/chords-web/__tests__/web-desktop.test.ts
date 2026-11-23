import { expect, test } from "bun:test";
import buildHandler from "../src/js/web-desktop";

function fixture(focused: string[], loseFocus = false) {
  const actions: { target: string; expression: string }[] = [];
  const server = Bun.serve<string>({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request, server) {
      const { host, pathname } = new URL(request.url);
      if (pathname === "/json/list") {
        return Response.json([
          { type: "page", webSocketDebuggerUrl: `ws://${host}/devtools/page/background` },
          { type: "page", webSocketDebuggerUrl: `ws://${host}/devtools/page/foreground` },
          { type: "page", webSocketDebuggerUrl: `ws://${host}/unrelated` },
          { type: "service_worker", webSocketDebuggerUrl: `ws://${host}/devtools/page/worker` },
        ]);
      }
      if (server.upgrade(request, { data: pathname.split("/").at(-1)! })) return;
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      message(socket, message) {
        const {
          id,
          params: { expression },
        } = JSON.parse(String(message));
        const probe = expression === "document.hasFocus()";
        if (!probe) actions.push({ target: socket.data, expression });
        socket.send(
          JSON.stringify({
            id,
            result: { result: { value: focused.includes(socket.data) && (probe || !loseFocus) } },
          }),
        );
      },
    },
  });
  return { server, actions };
}

const chrome = { focusedAppId: "com.google.Chrome" };

test("scrolls only the single focused browser page", async () => {
  const { server, actions } = fixture(["foreground", "unrelated", "worker"]);
  try {
    await buildHandler(server.port!).call(chrome, "EAST");
    expect(actions).toHaveLength(1);
    expect(actions[0]?.target).toBe("foreground");
    expect(actions[0]?.expression).toContain("document.hasFocus() &&");
    expect(actions[0]?.expression).toContain("top: 0, left: 100");
  } finally {
    server.stop(true);
  }
});

test("ignores other applications and ambiguous or missing page focus", async () => {
  const { server, actions } = fixture(["foreground", "background"]);
  try {
    const scroll = buildHandler(server.port!);
    await expect(scroll.call({ focusedAppId: "executable.code" }, "NORTH")).rejects.toThrow(
      "not a supported",
    );
    await expect(scroll.call(chrome, "NORTH")).rejects.toThrow("Focus one page");
    expect(actions).toHaveLength(0);
  } finally {
    server.stop(true);
  }
});

test("reports when focus changes between selection and the scroll command", async () => {
  const { server } = fixture(["foreground"], true);
  try {
    await expect(buildHandler(server.port!).call(chrome, "SOUTH")).rejects.toThrow("focus changed");
  } finally {
    server.stop(true);
  }
});
