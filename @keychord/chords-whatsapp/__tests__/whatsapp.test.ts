import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import type { WhatsAppAction } from "../src/js/whatsapp";
import { cases } from "./cases";

const { perform, click, getAppWindows } = vi.hoisted(() => ({
  perform: vi.fn(),
  click: vi.fn(),
  getAppWindows: vi.fn(),
}));
vi.mock("../src/js/whatsapp.node", () => ({ default: { perform } }));
vi.mock("chord", () => ({ click, getAppWindows }));
import buildWhatsAppHandler from "../src/js/whatsapp";

beforeEach(() => {
  perform.mockReset().mockResolvedValue("");
  click.mockReset().mockResolvedValue(undefined);
  getAppWindows.mockReset().mockReturnValue([]);
});

test("all existing executable chords go through the WhatsApp handler", async () => {
  const definitions = JSON.parse(
    execFileSync(
      "bun",
      ["-e", "console.log(JSON.stringify(Bun.TOML.parse(await Bun.stdin.text())))"],
      {
        input: readFileSync(
          new URL("../chords/net/whatsapp/WhatsApp/macos.toml", import.meta.url),
          "utf8",
        ),
        encoding: "utf8",
      },
    ),
  );
  expect(definitions.on).toEqual({ whatsapp: { file: "whatsapp.js" } });
  const handler = buildWhatsAppHandler();
  const bindings = Object.entries(definitions.chords).filter(([chord]) => !chord.startsWith("?"));
  expect(bindings.map(([chord]) => chord).sort()).toEqual(
    cases.map((scenario) => scenario.chord).sort(),
  );
  for (const [chord, value] of bindings) {
    const binding = value as Record<string, any>;
    expect(binding.shortcut).toBeUndefined();
    expect(binding["@input:whatsapp"]).toBeDefined();
    const [action, index] = binding["@input:whatsapp"];
    const expected = cases.find((scenario) => scenario.chord === chord)!;
    expect(binding["@input:whatsapp"]).toEqual(
      expected.index === undefined ? [expected.action] : [expected.action, expected.index],
    );
    await handler.call({ focusedAppId: "com.apple.TextEdit" }, action, expected.input ?? index);
    expect(perform).toHaveBeenLastCalledWith("net.whatsapp.WhatsApp", expect.any(String));
  }
});

test.each(cases)(
  "$chord dispatches $action through the native UI bridge",
  async ({ action, index, input }) => {
    await buildWhatsAppHandler()(action, input ?? index);
    expect(perform).toHaveBeenCalled();
    for (const [app, json] of perform.mock.calls) {
      expect(app).toBe("net.whatsapp.WhatsApp");
      expect(JSON.parse(json)[0].kind).toMatch(/^(MENU|ELEMENT|CHAT|GRID)$/);
    }
  },
);

test.each([undefined, 0, "00", "10", "1", "123", "1,0", "1,,2", "1,2junk"])(
  "invalid palette position %s performs no action",
  async (position) => {
    await expect(buildWhatsAppHandler()("CHAT_INFO_THEME_BUBBLE_SELECT", position)).rejects.toThrow(
      "row,column",
    );
    expect(perform).not.toHaveBeenCalled();
  },
);

test.each(["23", "2,3"])("palette position %s resolves a row and column", async (position) => {
  await buildWhatsAppHandler()("CHAT_INFO_THEME_WALLPAPER_SELECT", position);
  expect(JSON.parse(perform.mock.lastCall![1])).toEqual([
    { kind: "GRID", description: "Wallpaper", row: 2, column: 3 },
  ]);
});

test("direct menu actions use identifiers and include both toggle states", async () => {
  const handler = buildWhatsAppHandler();
  await handler("CHAT_INFO");
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1)).toMatchObject({
    kind: "MENU",
    identifiers: ["contact_info", "group_info"],
  });
  await handler("CHAT_PIN");
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1).identifiers).toEqual(["pin", "unpin"]);
  await handler("INPUT_GIF");
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1).identifiers).toEqual(["send_gifs"]);
  await handler("INPUT_STICKER");
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1).identifiers).toEqual(["send_stickers"]);
  await handler("VIEW_ARCHIVED");
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1)).toEqual({
    kind: "ELEMENT",
    identifiers: ["SidebarButton_Archived"],
  });
});

test("commands wait for completion and continue after a rejected action", async () => {
  let reject!: (error: Error) => void;
  perform.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const handler = buildWhatsAppHandler();
  const first = handler("CHAT_INFO");
  const failed = expect(first).rejects.toThrow("disabled");
  const second = handler("VIEW_CHATS");
  await vi.waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
  reject(new Error("disabled"));
  await failed;
  await second;
  expect(perform).toHaveBeenCalledTimes(2);
});

test.each([undefined, 0, 10, -1, 1.5, "01", "1junk"])(
  "invalid chat index %s performs no action",
  async (index) => {
    await expect(buildWhatsAppHandler()("CHAT_SWITCH", index)).rejects.toThrow("between 1 and 9");
    expect(perform).not.toHaveBeenCalled();
  },
);

test("chat index validation and unknown actions never poison the queue", async () => {
  const handler = buildWhatsAppHandler();
  await expect(handler("toString" as WhatsAppAction)).rejects.toThrow("Unknown WhatsApp action");
  for (let index = 1; index <= 9; index++) {
    await handler("CHAT_SWITCH", String(index));
    expect(JSON.parse(perform.mock.lastCall![1]).at(-1)).toEqual({
      kind: "CHAT",
      index,
    });
  }
});

test("Profile and Mute navigate to UI controls without key events", async () => {
  const handler = buildWhatsAppHandler();
  await handler("VIEW_PROFILE");
  expect(perform.mock.calls.flatMap(([, json]) => JSON.parse(json))).toEqual([
    { kind: "MENU", scope: "com.apple.menu.application", identifiers: ["settings"] },
    { kind: "ELEMENT", identifiers: ["SettingsView_ProfileCell"], role: "AXButton" },
  ]);
  await handler("CHAT_MUTE");
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1)).toMatchObject({
    kind: "ELEMENT",
    description: "Mute",
    role: "AXButton",
  });
});

test("bubble reset clicks More before selecting the reset menu identifier", async () => {
  await buildWhatsAppHandler()("CHAT_INFO_THEME_BUBBLE_RESET");
  expect(perform.mock.calls.slice(-2).flatMap(([, json]) => JSON.parse(json))).toEqual([
    { kind: "ELEMENT", description: "More", role: "AXButton", click: true },
    { kind: "ELEMENT", identifiers: ["reset_chat_bubble"] },
  ]);
});

test("text controls use a click in the matching WhatsApp window", async () => {
  const bounds = { x: 100, y: 200, width: 600, height: 700 };
  perform.mockResolvedValueOnce(
    JSON.stringify({ processId: 42, point: { x: 250, y: 420 }, bounds }),
  );
  getAppWindows.mockReturnValue([{ windowId: 12, processId: 42, bounds }]);
  await buildWhatsAppHandler()("VIEW_ARCHIVED");
  expect(getAppWindows).toHaveBeenCalledWith("net.whatsapp.WhatsApp");
  expect(click).toHaveBeenCalledExactlyOnceWith({
    windowId: 12,
    x: 150,
    y: 220,
    expectedBounds: bounds,
  });
});

test.each(["MOVED", "REPLACED", "AMBIGUOUS"])(
  "a %s window cannot receive a resolved click",
  async (state) => {
    const bounds = { x: 100, y: 200, width: 600, height: 700 };
    perform.mockResolvedValue(JSON.stringify({ processId: 42, point: { x: 250, y: 420 }, bounds }));
    const window = {
      windowId: 12,
      processId: state === "REPLACED" ? 43 : 42,
      bounds: { ...bounds, x: state === "MOVED" ? 110 : 100 },
    };
    getAppWindows.mockReturnValue(state === "AMBIGUOUS" ? [window, window] : [window]);
    await expect(buildWhatsAppHandler()("VIEW_ARCHIVED")).rejects.toThrow(
      "moved or is unavailable",
    );
    expect(click).not.toHaveBeenCalled();
  },
);

test("UI navigation waits for each click before resolving the next control", async () => {
  const bounds = { x: 100, y: 200, width: 600, height: 700 };
  perform
    .mockResolvedValueOnce("")
    .mockResolvedValueOnce(JSON.stringify({ processId: 42, point: { x: 250, y: 420 }, bounds }));
  getAppWindows.mockReturnValue([{ windowId: 12, processId: 42, bounds }]);
  let finish!: () => void;
  click.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const handler = buildWhatsAppHandler();
  const first = handler("VIEW_PROFILE");
  const second = handler("CHAT_PIN");
  await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(perform).toHaveBeenCalledTimes(2);
  finish();
  await Promise.all([first, second]);
  expect(perform).toHaveBeenCalledTimes(3);
});
