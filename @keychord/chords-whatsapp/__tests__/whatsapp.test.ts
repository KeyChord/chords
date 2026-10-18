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
  ["igm.(\\d+)", "igm.12", "12"],
  ["igmr(\\d+)", "igmr12", "12"],
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
        /^(MENU|ELEMENT|CHAT|PARTICIPANT|MEMBER|GRID|DEVICE|DISMISS_POPOVER|GROUP_PERMISSIONS|VERIFY|FILTER|FILTER_SELECTED|OPEN_CHAT|OPEN_WINDOW|SEARCH_CHAT|MAIN_WINDOW)$/,
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
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1)).toEqual({
    kind: "GRID",
    description: "Wallpaper",
    row: 2,
    column: 3,
  });
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

test.each(["CHAT_SEARCH", "CHAT_INFO_SEARCH"] as const)(
  "%s opens the chat's search from the menu or Info, then waits for its focused field",
  async (action) => {
    await buildWhatsAppHandler()(action);
    const info = { identifiers: ["contact-info-view-content-stack-view"] };
    expect(perform.mock.calls.flatMap(([, json]) => JSON.parse(json))).toEqual([
      {
        kind: "MENU",
        scope: "UIMenuChatListIdentifier",
        identifiers: ["search_chat"],
        // The menu toggles the bar, and Info disables it.
        unlessAny: [info, { description: "Search", role: "AXTextField" }],
      },
      expect.objectContaining({
        kind: "ELEMENT",
        scope: "contact-info-view-content-stack-view",
        description: "Search",
        role: "AXButton",
        onlyIfAny: [info],
      }),
      { kind: "SEARCH_CHAT" },
    ]);
  },
);

test("open in new window uses WhatsApp's shortcut instead of the toolbar's More menu", async () => {
  await buildWhatsAppHandler()("CHAT_OPEN_WINDOW");
  expect(perform.mock.calls.map(([, json]) => JSON.parse(json))).toEqual([
    [{ kind: "OPEN_WINDOW" }],
  ]);
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
    { kind: "MAIN_WINDOW", scope: "com.apple.menu.application", identifiers: ["open_main_window"] },
    { kind: "MENU", scope: "com.apple.menu.view", identifiers: ["chats"] },
    { kind: "CHAT", index: 12 },
    expect.objectContaining({ kind: "MENU", identifiers: ["contact_info", "group_info"] }),
  ]);
});

test.each([
  ["VIEW_CHATS", { kind: "MENU", scope: "com.apple.menu.view", identifiers: ["chats"] }, "CHAT"],
  ["VIEW_ARCHIVED", { kind: "ELEMENT", identifiers: ["SidebarButton_Archived"] }, "CHAT"],
  ["VIEW_CHATS_ALL", { kind: "FILTER_SELECTED", description: "All" }, "OPEN_CHAT"],
  ["VIEW_CHATS_UNREAD", { kind: "FILTER_SELECTED", description: "Unread" }, "OPEN_CHAT"],
  ["VIEW_CHATS_FAVOURITES", { kind: "FILTER_SELECTED", description: "Favourites" }, "OPEN_CHAT"],
  ["VIEW_CHATS_GROUPS", { kind: "FILTER_SELECTED", description: "Groups" }, "OPEN_CHAT"],
] as const)(
  "%s opens its view before selecting a numbered chat",
  async (action, destination, kind) => {
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
        kind: "MAIN_WINDOW",
        scope: "com.apple.menu.application",
        identifiers: ["open_main_window"],
      });
      expect(steps.at(-2)).toMatchObject(destination);
      expect(steps.at(-1)).toEqual({ kind, index });
    }
    perform.mockClear();
    for (const index of [0, -1, 1.5, "00", "01", "1junk", "9007199254740992", Infinity, NaN]) {
      await expect(handler(action, index)).rejects.toThrow("positive safe integer");
    }
    expect(perform).not.toHaveBeenCalled();
  },
);

test("a filter presses its chip, then waits for the chip to be selected", async () => {
  await buildWhatsAppHandler()("VIEW_CHATS_GROUPS");
  expect(perform.mock.calls.flatMap(([, json]) => JSON.parse(json))).toEqual([
    { kind: "MAIN_WINDOW", scope: "com.apple.menu.application", identifiers: ["open_main_window"] },
    { kind: "MENU", scope: "com.apple.menu.view", identifiers: ["chats"] },
    { kind: "FILTER", description: "Groups" },
    { kind: "FILTER_SELECTED", description: "Groups" },
  ]);
});

test("a numbered group opens its chat only after the Groups filter is selected", async () => {
  await buildWhatsAppHandler()("VIEW_CHATS_GROUPS", "1");
  // The native steps run in order, so the chat shortcut waits for the selected chip.
  expect(perform).toHaveBeenCalledTimes(1);
  expect(JSON.parse(perform.mock.lastCall![1]).slice(-3)).toEqual([
    { kind: "FILTER", description: "Groups" },
    { kind: "FILTER_SELECTED", description: "Groups" },
    { kind: "OPEN_CHAT", index: 1 },
  ]);
});

const infoOpen = { identifiers: ["contact-info-view-content-stack-view"] };
const blocked = { description: "Unblock", role: "AXButton" };
const blockDialog = [
  { description: "Block", role: "AXButton" },
  { description: "Block and report", role: "AXButton" },
];
const blockToggle = {
  kind: "MENU",
  scope: "UIMenuChatListIdentifier",
  titlePrefixes: ["Block ", "Unblock "],
  missing: "Chat › Block (open a contact's chat)",
};

test.each(["CHAT_BLOCK", "CHAT_INFO_BLOCK", "CHAT_INFO_BLOCK_REPORT"] as const)(
  "%s skips every step for a blocked contact, where Chat › Block would unblock",
  async (action) => {
    await buildWhatsAppHandler()(action);
    const steps = perform.mock.calls.flatMap(([, json]) => JSON.parse(json));
    for (const step of steps) {
      // Closing Info changes nothing about the contact.
      if (step.onlyIfAny?.[0]?.identifiers?.[0] === "contact-info-view-content-stack-view")
        continue;
      expect(step.unlessAny).toContainEqual(blocked);
    }
  },
);

test.each([
  ["CHAT_INFO_BLOCK", "Block"],
  ["CHAT_INFO_BLOCK_REPORT", "Block and report"],
  ["CHAT_INFO_UNBLOCK", "Unblock"],
] as const)(
  "%s invokes only its named confirmation in the action sheet",
  async (action, description) => {
    await buildWhatsAppHandler()(action);
    const steps = perform.mock.calls.flatMap(([, json]) => JSON.parse(json));
    // The sheet title's parent holds only the title; its dialog holds the buttons.
    expect(steps.at(-1)).toMatchObject({
      kind: "ELEMENT",
      scope: "ActionSheet_TitleLabel",
      description,
      role: "AXButton",
    });
    expect(steps.at(-1).scopeParent).toBeUndefined();
    expect(steps.at(-1).optional).toBe(action === "CHAT_INFO_UNBLOCK" ? true : undefined);
    if (action === "CHAT_INFO_UNBLOCK") {
      expect(steps.at(-1).scopeAncestorRole).toBe("AXPopover");
      // Info's confirmation only follows Info's row; with Info closed the toggle
      // unblocks at once.
      expect(steps.at(-1).onlyIfAny).toEqual([
        infoOpen,
        { identifiers: ["ActionSheet_TitleLabel"] },
      ]);
      expect(steps[0]).toEqual({ ...blockToggle, onlyIfAny: [blocked], unlessAny: [infoOpen] });
    } else {
      // Chat › Block opens the dialog as a sheet while Info is closed; Info's row opens
      // it as a popover.
      expect(steps.at(-1).scopeAncestorRoles).toEqual(["AXPopover", "AXSheet"]);
      expect(steps.slice(0, 2)).toEqual([
        { ...blockToggle, unlessAny: [infoOpen, blocked, ...blockDialog] },
        {
          kind: "VERIFY",
          description: "Block",
          role: "AXButton",
          unlessAny: [infoOpen, blocked],
        },
      ]);
    }
    // Pressing the Info row scrolls it into view so its sheet can open.
    expect(steps.at(-2)).toMatchObject({
      scope: "contact-info-view-content-stack-view",
      scopeParent: true,
      scroll: true,
    });
  },
);

test.each([
  "CHAT_INFO_THEME",
  "CHAT_INFO_AVATAR",
  "CHAT_INFO_SHARE_CONTACT",
  "CHAT_INFO_FAVOURITE",
  "CHAT_INFO_GALLERY",
  "CHAT_INFO_PRIVACY",
  "CHAT_INFO_REPORT",
  "CHAT_MUTE",
  "GROUP_MEMBERS",
  "GROUP_PERMISSIONS",
] as const)("%s finds its Info row anywhere in the list", async (action) => {
  await buildWhatsAppHandler()(action);
  const steps = perform.mock.calls.flatMap(([, json]) => JSON.parse(json));
  expect(steps).toContainEqual(
    expect.objectContaining({
      scope: "contact-info-view-content-stack-view",
      scopeParent: true,
      scroll: true,
    }),
  );
});

test("a numbered group member closes an open action sheet before it is counted", async () => {
  await buildWhatsAppHandler()("GROUP_MEMBER_SELECT", "12");
  expect(perform.mock.calls.flatMap(([, json]) => JSON.parse(json))).toEqual([
    expect.objectContaining({
      kind: "MENU",
      identifiers: ["contact_info", "group_info"],
      unlessIdentifier: "contact-info-view-content-stack-view",
      unlessAny: [{ identifiers: ["ActionSheet_TitleLabel"] }],
    }),
    { kind: "DISMISS_POPOVER", scope: "ActionSheet_TitleLabel", scopeAncestorRole: "AXPopover" },
    {
      kind: "MEMBER",
      scope: "contact-info-view-content-stack-view",
      scopeParent: true,
      scroll: true,
      index: 12,
    },
  ]);
});

test("a numbered removal selects the member, then removes and confirms", async () => {
  await buildWhatsAppHandler()("GROUP_MEMBER_REMOVE", "12");
  const actionSheet = { scope: "ActionSheet_TitleLabel", scopeAncestorRole: "AXPopover" };
  expect(perform.mock.calls.flatMap(([, json]) => JSON.parse(json))).toEqual([
    expect.objectContaining({
      kind: "MENU",
      identifiers: ["contact_info", "group_info"],
      unlessAny: [{ identifiers: ["ActionSheet_TitleLabel"] }],
    }),
    { kind: "DISMISS_POPOVER", ...actionSheet },
    {
      kind: "MEMBER",
      scope: "contact-info-view-content-stack-view",
      scopeParent: true,
      scroll: true,
      index: 12,
    },
    {
      kind: "ELEMENT",
      ...actionSheet,
      role: "AXButton",
      missing: "Group member #12's options",
      description: "Remove from group",
    },
    { kind: "ELEMENT", ...actionSheet, description: "Remove", role: "AXButton" },
  ]);
});

test("invalid group member positions never open Info or a member's options", async () => {
  const handler = buildWhatsAppHandler();
  for (const index of [undefined, 0, -1, 1.5, "01", "12junk", "9007199254740992"]) {
    await expect(handler("GROUP_MEMBER_SELECT", index)).rejects.toThrow("positive safe integer");
    if (index !== undefined) {
      await expect(handler("GROUP_MEMBER_REMOVE", index)).rejects.toThrow("positive safe integer");
    }
  }
  expect(perform).not.toHaveBeenCalled();
});

test.each([
  ["GROUP_MEMBER_INFO", { description: "Info" }],
  ["GROUP_MEMBER_ADMIN", { descriptions: ["Make group admin", "Dismiss as admin"] }],
  ["GROUP_MEMBER_REMOVE", { description: "Remove from group" }],
] as const)("%s presses only inside the open member options", async (action, control) => {
  await buildWhatsAppHandler()(action);
  const steps = perform.mock.calls.flatMap(([, json]) => JSON.parse(json));
  expect(steps[0]).toEqual({
    kind: "ELEMENT",
    scope: "ActionSheet_TitleLabel",
    scopeAncestorRole: "AXPopover",
    role: "AXButton",
    missing: "Group member options (open them with igm.<number>)",
    ...control,
  });
  // Removing confirms WhatsApp's follow-up sheet; the other options do not confirm.
  expect(steps.slice(1)).toEqual(
    action === "GROUP_MEMBER_REMOVE"
      ? [
          {
            kind: "ELEMENT",
            scope: "ActionSheet_TitleLabel",
            scopeAncestorRole: "AXPopover",
            description: "Remove",
            role: "AXButton",
          },
        ]
      : [],
  );
});

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
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1)).toEqual({ kind: "PARTICIPANT", index: 12 });
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
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1).index).toBe(12);
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
  expect(perform.mock.calls.flatMap(([, json]) => JSON.parse(json)).slice(-2)).toEqual([
    { kind: "ELEMENT", description: "More", role: "AXButton", click: true },
    { kind: "ELEMENT", identifiers: ["reset_chat_bubble"] },
  ]);
});

test("text controls use a click in the matching WhatsApp window", async () => {
  const bounds = { x: 100, y: 200, width: 600, height: 700 };
  perform.mockResolvedValueOnce(
    JSON.stringify({ processId: 42, next: 2, point: { x: 250, y: 420 }, bounds }),
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
    perform.mockResolvedValue(
      JSON.stringify({ processId: 42, next: 2, point: { x: 250, y: 420 }, bounds }),
    );
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
  perform.mockResolvedValueOnce(
    JSON.stringify({ processId: 42, next: 2, point: { x: 250, y: 420 }, bounds }),
  );
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
  expect(perform).toHaveBeenCalledTimes(1);
  finish();
  await Promise.all([first, second]);
  expect(perform).toHaveBeenCalledTimes(2);
});

test("one native call runs an action's steps and resumes after a window click", async () => {
  const bounds = { x: 100, y: 200, width: 600, height: 700 };
  getAppWindows.mockReturnValue([{ windowId: 12, processId: 42, bounds }]);
  await buildWhatsAppHandler()("CHAT_INFO_THEME_WALLPAPER_PHOTO");
  expect(perform).toHaveBeenCalledTimes(1);
  expect(JSON.parse(perform.mock.lastCall![1]).at(-1)).toEqual({
    kind: "ELEMENT",
    description: "Choose photo",
    role: "AXButton",
  });

  perform.mockReset().mockResolvedValue("");
  // The bubble reset menu is opened by clicking More, then its item is pressed.
  perform.mockResolvedValueOnce(
    JSON.stringify({ processId: 42, next: 5, point: { x: 250, y: 420 }, bounds }),
  );
  await buildWhatsAppHandler()("CHAT_INFO_THEME_BUBBLE_RESET");
  expect(click).toHaveBeenCalledTimes(1);
  expect(perform).toHaveBeenCalledTimes(2);
  const [first, rest] = perform.mock.calls.map(([, json]) => JSON.parse(json));
  expect(first[4]).toEqual({ kind: "ELEMENT", description: "More", role: "AXButton", click: true });
  expect(rest).toEqual([{ kind: "ELEMENT", identifiers: ["reset_chat_bubble"] }]);
});

test.each([undefined, 0, 7, 1.5])(
  "a click result with resume step %s fails instead of repeating steps",
  async (next) => {
    const bounds = { x: 100, y: 200, width: 600, height: 700 };
    perform.mockResolvedValue(
      JSON.stringify({ processId: 42, next, point: { x: 250, y: 420 }, bounds }),
    );
    getAppWindows.mockReturnValue([{ windowId: 12, processId: 42, bounds }]);
    await expect(buildWhatsAppHandler()("CHAT_INFO_THEME_BUBBLE_RESET")).rejects.toThrow(
      "did not report where to resume",
    );
    expect(perform).toHaveBeenCalledTimes(1);
    expect(click).not.toHaveBeenCalled();
  },
);
