import { beforeEach, expect, mock, test } from "bun:test";
import { waitFor } from "@keychord/chordtest/test";
import { chordPattern } from "@keychord/chordtest/patterns";
import type { WhatsAppAction } from "../src/js/whatsapp";
import { cases } from "./cases";

const perform = mock();
const click = mock();
const getAppWindows = mock();
mock.module("../src/js/whatsapp.node", () => ({ default: { perform } }));
mock.module("chord", () => ({ click, getAppWindows }));
// Import after the mocks, as vitest's hoisted vi.mock did.
const { default: buildWhatsAppHandler } = await import("../src/js/whatsapp");

beforeEach(() => {
  perform.mockReset().mockResolvedValue("");
  click.mockReset().mockResolvedValue(undefined);
  getAppWindows.mockReset().mockReturnValue([]);
});

test("every non-hint chord is implemented and covered", async () => {
  const definitions = Bun.TOML.parse(
    await Bun.file(new URL("../chords/net/whatsapp/WhatsApp/macos.toml", import.meta.url)).text(),
  ) as { on: unknown; chords: Record<string, unknown> };
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

test.each([
  ["ci(\\d+)", "ci12", "12"],
  ["cgc.(\\d+)", "cgc.12", "12"],
  ["gc(\\d+)", "gc12", "12"],
  ["gch(\\d+)", "gch12", "12"],
  ["gca(\\d+)", "gca12", "12"],
  ["gcu(\\d+)", "gcu12", "12"],
  ["gcf(\\d+)", "gcf12", "12"],
  ["gcg(\\d+)", "gcg1", "1"],
] as const)("%s captures the position from %s using Chord's grammar", async (key, input, index) => {
  const definitions = Bun.TOML.parse(
    await Bun.file(new URL("../chords/net/whatsapp/WhatsApp/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(definitions.chords[key]).toBeDefined();
  expect(chordPattern(key).exec(input)?.[1]).toBe(index);
});

test.each(cases)(
  "$chord dispatches $action through the native UI bridge",
  async ({ action, index, input }) => {
    await buildWhatsAppHandler()(action, input ?? index);
    expect(perform).toHaveBeenCalled();
    for (const [app, json] of perform.mock.calls) {
      expect(app).toBe("net.whatsapp.WhatsApp");
      expect(JSON.parse(json)[0].kind).toMatch(
        /^(MENU|ELEMENT|CHAT|PARTICIPANT|GRID|DEVICE|DISMISS_POPOVER|GROUP_PERMISSIONS|VERIFY)$/,
      );
    }
  },
);

test("group permissions verifies the destination after its row is invoked", async () => {
  await buildWhatsAppHandler()("GROUP_PERMISSIONS");
  const steps = perform.mock.calls.flatMap(([, json]) => JSON.parse(json));
  expect(steps.at(-2)).toMatchObject({
    kind: "GROUP_PERMISSIONS",
    scope: "contact-info-view-content-stack-view",
    scopeParent: true,
    scroll: true,
    unlessAny: [
      { description: "Group permissions", role: "AXHeading" },
      { description: "Group settings", role: "AXHeading" },
    ],
  });
  expect(steps.at(-1)).toEqual({
    kind: "VERIFY",
    descriptions: ["Group permissions", "Group settings"],
    role: "AXHeading",
  });
});

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
  // Bun's `expect(promise).rejects` blocks until the promise settles; capture the error instead.
  const failed = first.then(
    () => undefined,
    (error: unknown) => error,
  );
  const second = handler("VIEW_CHATS");
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
  reject(new Error("disabled"));
  expect(String(await failed)).toContain("disabled");
  await second;
  expect(perform).toHaveBeenCalledTimes(2);
});

test.each([undefined, 0, -1, 1.5, "01", "1junk", "9007199254740992", Infinity, NaN])(
  "invalid chat index %s performs no action",
  async (index) => {
    await expect(buildWhatsAppHandler()("CHAT_SWITCH", index)).rejects.toThrow(
      "positive safe integer",
    );
    await expect(buildWhatsAppHandler()("CHAT_INFO_AT", index)).rejects.toThrow(
      "positive safe integer",
    );
    expect(perform).not.toHaveBeenCalled();
  },
);

test("numbered chat info selects its chat before opening the info dialog", async () => {
  await buildWhatsAppHandler()("CHAT_INFO_AT", "12");
  expect(perform.mock.calls.flatMap(([, json]) => JSON.parse(json))).toEqual([
    expect.objectContaining({
      kind: "ELEMENT",
      scope: "contact-info-view-content-stack-view",
      description: "close",
    }),
    { kind: "MENU", scope: "com.apple.menu.application", identifiers: ["open_main_window"] },
    { kind: "MENU", scope: "com.apple.menu.view", identifiers: ["chats"] },
    { kind: "CHAT", index: 12 },
    expect.objectContaining({ kind: "MENU", identifiers: ["contact_info", "group_info"] }),
  ]);
});

test.each([
  ["VIEW_CHATS", { kind: "MENU", scope: "com.apple.menu.view", identifiers: ["chats"] }],
  ["VIEW_ARCHIVED", { kind: "ELEMENT", identifiers: ["SidebarButton_Archived"] }],
  ["VIEW_CHATS_ALL", { kind: "ELEMENT", description: "All" }],
  ["VIEW_CHATS_UNREAD", { kind: "ELEMENT", description: "Unread" }],
  ["VIEW_CHATS_FAVOURITES", { kind: "ELEMENT", description: "Favourites" }],
  ["VIEW_CHATS_GROUPS", { kind: "ELEMENT", description: "Groups" }],
] as const)("%s opens its view before selecting a numbered chat", async (action, destination) => {
  const handler = buildWhatsAppHandler();
  for (const index of [1, 12]) {
    perform.mockClear();
    await handler(action, String(index));
    const steps = perform.mock.calls.flatMap(([, json]) => JSON.parse(json));
    expect(steps[0]).toMatchObject({
      kind: "ELEMENT",
      scope: "contact-info-view-content-stack-view",
      description: "close",
    });
    expect(steps[1]).toEqual({
      kind: "MENU",
      scope: "com.apple.menu.application",
      identifiers: ["open_main_window"],
    });
    expect(steps.at(-2)).toMatchObject(destination);
    expect(steps.at(-1)).toEqual({ kind: "CHAT", index });
  }
  perform.mockClear();
  for (const index of [0, -1, 1.5, "00", "01", "1junk", "9007199254740992", Infinity, NaN]) {
    await expect(handler(action, index)).rejects.toThrow("positive safe integer");
  }
  expect(perform).not.toHaveBeenCalled();
});

test("a numbered group waits for the Groups filter before selecting its chat", async () => {
  let filtered!: () => void;
  perform
    .mockResolvedValueOnce("")
    .mockResolvedValueOnce("")
    .mockResolvedValueOnce("")
    .mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          filtered = () => resolve("");
        }),
    );
  const pending = buildWhatsAppHandler()("VIEW_CHATS_GROUPS", "1");
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(4));
  expect(JSON.parse(perform.mock.lastCall![1])[0]).toMatchObject({ description: "Groups" });
  filtered();
  await pending;
  expect(JSON.parse(perform.mock.lastCall![1])).toEqual([{ kind: "CHAT", index: 1 }]);
});

test.each([
  ["CHAT_INFO_BLOCK", "Block"],
  ["CHAT_INFO_BLOCK_REPORT", "Block and report"],
  ["CHAT_INFO_UNBLOCK", "Unblock"],
] as const)(
  "%s invokes only its named confirmation in the action sheet",
  async (action, description) => {
    await buildWhatsAppHandler()(action);
    expect(JSON.parse(perform.mock.lastCall![1])[0]).toMatchObject({
      kind: "ELEMENT",
      scope: "ActionSheet_TitleLabel",
      scopeParent: true,
      description,
      role: "AXButton",
    });
    expect(JSON.parse(perform.mock.lastCall![1])[0].optional).toBe(
      action === "CHAT_INFO_UNBLOCK" ? true : undefined,
    );
  },
);

test("chat index validation and unknown actions never poison the queue", async () => {
  const handler = buildWhatsAppHandler();
  await expect(handler("toString" as WhatsAppAction)).rejects.toThrow("Unknown WhatsApp action");
  for (const index of [1, 9, 10, 12, 123, Number.MAX_SAFE_INTEGER]) {
    await handler("CHAT_SWITCH", String(index));
    expect(JSON.parse(perform.mock.lastCall![1]).at(-1)).toEqual({
      kind: "CHAT",
      index,
    });
  }
});

test("invalid group member indices never open or change a picker", async () => {
  const handler = buildWhatsAppHandler();
  for (const index of [undefined, 0, -1, 1.5, "01", "12junk", "9007199254740992"]) {
    await expect(handler("CHAT_GROUP_SELECT", index)).rejects.toThrow("positive safe integer");
  }
  expect(perform).not.toHaveBeenCalled();
  await handler("CHAT_GROUP_SELECT", "12");
  expect(JSON.parse(perform.mock.lastCall![1])).toEqual([{ kind: "PARTICIPANT", index: 12 }]);
});

test.each([
  "CALL_CAMERA_SELECT",
  "CALL_MICROPHONE_SELECT",
  "CALL_SPEAKER_SELECT",
  "CALL_REACTION_SELECT",
] as const)("%s rejects invalid choices before opening any controls", async (action) => {
  const handler = buildWhatsAppHandler();
  for (const position of [undefined, 0, -1, 1.5, "01", "2junk", "9007199254740992"]) {
    await expect(handler(action, position)).rejects.toThrow("positive safe integer");
  }
  expect(perform).not.toHaveBeenCalled();
  await handler(action, "12");
  expect(JSON.parse(perform.mock.lastCall![1])[0].index).toBe(12);
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
  expect(click).toHaveBeenCalledTimes(1);
  expect(click).toHaveBeenCalledWith({
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
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect(perform).toHaveBeenCalledTimes(2);
  finish();
  await Promise.all([first, second]);
  expect(perform).toHaveBeenCalledTimes(3);
});
