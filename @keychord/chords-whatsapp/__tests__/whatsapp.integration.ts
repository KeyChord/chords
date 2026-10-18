import assert from "node:assert/strict";
import builtHandler from "../js/whatsapp.js";
import { waitFor } from "@keychord/chordtest/macos";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { cases } from "./cases";

requireMacOSVM();
const buildHandler = builtHandler as typeof import("../src/js/whatsapp").default;
const [targetId, output, coverId, coverOutput, scope] = Bun.argv.slice(2);
const handler = buildHandler(targetId);
const cover = buildHandler(coverId);
let token = 0;
async function reset(mode = "DEFAULT") {
  await Bun.write(output + ".request", JSON.stringify({ token: ++token, mode }));
  await waitFor(async () => {
    const state = await Bun.file(output).json();
    return state.request === token && state.action === "READY" ? true : undefined;
  });
}
async function recorded(action: string) {
  try {
    await waitFor(async () => {
      const state = await Bun.file(output).json();
      return state.action === action && state.active === true ? true : undefined;
    });
  } catch (cause) {
    throw new Error(`Expected ${action}; observed ${await Bun.file(output).text()}`, { cause });
  }
}

const { chords } = Bun.TOML.parse(
  await Bun.file(new URL("../chords/net/whatsapp/WhatsApp/macos.toml", import.meta.url)).text(),
) as {
  chords: Record<
    string,
    { "@input:whatsapp"?: [Parameters<typeof handler>[0], (number | string)?] }
  >;
};
assert.deepEqual(
  Object.entries(chords)
    .filter(([chord]) => !chord.startsWith("?"))
    .map(([chord]) => chord)
    .sort(),
  cases.map((test) => test.chord).sort(),
);
for (const scenario of cases) {
  if (scope === "VOICE" && !scenario.chord.startsWith("v") && scenario.action !== "CHAT_SWITCH")
    continue;
  await reset(scenario.mode);
  const coverSequence = (await Bun.file(coverOutput).json()).sequence;
  await cover("VIEW_CHATS");
  await waitFor(async () => {
    const state = await Bun.file(coverOutput).json();
    return state.sequence > coverSequence && state.action === "chats" && state.active === true
      ? true
      : undefined;
  });
  const before = await Bun.file(coverOutput).json();
  const args = chords[scenario.chord]["@input:whatsapp"]!;
  assert.deepEqual(
    args,
    scenario.index === undefined ? [scenario.action] : [scenario.action, scenario.index],
  );
  await handler.call({ focusedAppId: coverId }, args[0], scenario.input ?? args[1]);
  await recorded(scenario.control);
  if (scenario.action === "CHAT_INFO_AT") {
    assert.equal((await Bun.file(output).json()).selectedChat, Number(scenario.input));
  }
  if (
    scenario.action === "CHAT_BLOCK" ||
    scenario.action === "CHAT_INFO_BLOCK" ||
    scenario.action === "CHAT_INFO_BLOCK_REPORT"
  ) {
    const state = await Bun.file(output).json();
    assert.equal(state.blocked, true);
    assert.equal(state.reported, scenario.action === "CHAT_INFO_BLOCK_REPORT");
  }
  if (scenario.action === "CHAT_INFO_UNBLOCK") {
    assert.equal((await Bun.file(output).json()).blocked, false);
  }
  if (scenario.action === "GROUP_MEMBER_REMOVE") {
    assert.deepEqual((await Bun.file(output).json()).removedMembers, [
      scenario.input === undefined ? 2 : Number(scenario.input),
    ]);
  }
  if (scenario.action === "CHAT_OPEN_WINDOW") {
    assert.equal((await Bun.file(output).json()).chatWindowOpen, true);
  }
  if (scenario.action === "CHAT_SEARCH" || scenario.action === "CHAT_INFO_SEARCH") {
    assert.equal((await Bun.file(output).json()).searchFocused, true);
  }
  assert.deepEqual(
    await Bun.file(coverOutput).json(),
    before,
    `${scenario.chord} changed the covering app`,
  );
  console.log(`whatsapp-chord-ok ${scenario.chord}`);
}

for (const index of [1, 9, 10, 12]) {
  await reset();
  await handler("CHAT_SWITCH", String(index));
  await recorded(`chat_${index}`);
}
// From a chat in its own window, chat list chords bring the main window forward
// before acting in it.
for (const [action, index, control] of [
  ["CHAT_SWITCH", "2", "chat_2"],
  ["VIEW_CHATS_GROUPS", undefined, "filter_groups"],
] as const) {
  await reset();
  await handler("CHAT_OPEN_WINDOW");
  await recorded("open_chat_window");
  assert.equal((await Bun.file(output).json()).mainKey, false);
  await handler(action, index);
  await recorded(control);
  assert.equal((await Bun.file(output).json()).mainKey, true);
}
await reset();
await assert.rejects(handler("CHAT_SWITCH", "13"), /not loaded/);

// An already-open picker must not be toggled closed, and audio sections must
// keep separate numbering even though they share one popover.
for (const [mode, action, index, control] of [
  ["CALL_CAMERA_OPEN", "CALL_CAMERA_SELECT", "3", "camera_3"],
  ["CALL_AUDIO_OPEN", "CALL_MICROPHONE_SELECT", "3", "microphone_3"],
  ["CALL_AUDIO_OPEN", "CALL_SPEAKER_SELECT", "1", "speaker_1"],
  ["CALL_CAMERA_OPEN", "CALL_SPEAKER_SELECT", "2", "speaker_2"],
  ["CALL_AUDIO_OPEN", "CALL_CAMERA_SELECT", "2", "camera_2"],
  ["CALL_REACTIONS_OPEN", "CALL_REACTION_SELECT", "12", "reaction_12"],
  ["CALL_REACTIONS_OPEN", "CALL_REACTION_SELECT", "13", "ReactionsTray_PlusSign"],
] as const) {
  await reset(mode);
  await handler(action, index);
  await recorded(control);
}
for (const action of [
  "CALL_CAMERA_SELECT",
  "CALL_MICROPHONE_SELECT",
  "CALL_SPEAKER_SELECT",
  "CALL_REACTION_SELECT",
] as const) {
  await reset("CALL");
  await assert.rejects(handler(action, "99"), /unavailable/);
  const state = await Bun.file(output).json();
  assert.ok(["camera_open", "audio_open", "reactions_open"].includes(state.action));
}
await reset("CALL");
await handler("CALL_REACTIONS");
await recorded("reactions_open");
const reactionsOpen = await Bun.file(output).json();
await handler("CALL_REACTIONS");
assert.deepEqual(await Bun.file(output).json(), reactionsOpen, "reopened the reaction tray");
await reset("CALL");
await handler("CALL_CHAT");
await waitFor(async () =>
  (await Bun.file(output).json()).chatVisible === true ? true : undefined,
);
await handler("CALL_CHAT");
await waitFor(async () =>
  (await Bun.file(output).json()).chatVisible === false ? true : undefined,
);
console.log(
  "whatsapp-voice-chat-ok: call controls, device sections, reactions, and chats beyond 9",
);
if (scope === "VOICE") process.exit(0);

// Each view has different fixture rows, so using the main list's position
// instead of the chosen filter would select a different chat. As in WhatsApp,
// the fixture applies a filter 75 ms after its chip is pressed, and filtered
// positions open through ⌘1–⌘9 and Next Chat (⇧⌘]).
for (const [action, filter, index, selectedChat, unavailable] of [
  ["VIEW_CHATS", "ALL", 12, 12, 13],
  ["VIEW_ARCHIVED", "ARCHIVED", 2, 11, 3],
  ["VIEW_CHATS_ALL", "ALL", 12, 12, 13],
  ["VIEW_CHATS_UNREAD", "UNREAD", 2, 5, 4],
  ["VIEW_CHATS_FAVOURITES", "FAVOURITES", 2, 9, 3],
  ["VIEW_CHATS_GROUPS", "GROUPS", 1, 3, 4],
] as const) {
  await reset();
  // A prefix may have already selected the view before its number is typed.
  await handler(action);
  await handler("CHAT_INFO");
  await handler(action, String(index));
  await recorded(`chat_${selectedChat}`);
  const state = await Bun.file(output).json();
  assert.equal(state.chatFilter, filter);
  assert.equal(state.selectedChat, selectedChat);
  await assert.rejects(
    handler(action, String(unavailable)),
    action === "VIEW_CHATS" || action === "VIEW_ARCHIVED" ? /not loaded/ : /unavailable/,
  );
  assert.equal((await Bun.file(output).json()).selectedChat, selectedChat);
  assert.equal((await Bun.file(output).json()).chatFilter, filter);
}

for (const index of [1, 9, 10, 12]) {
  await reset();
  // Typing the ci prefix can open the current chat's Info first.
  await handler("CHAT_INFO");
  await handler("CHAT_INFO_AT", String(index));
  await recorded("group_info");
  assert.equal((await Bun.file(output).json()).selectedChat, index);
}
await reset();
await assert.rejects(handler("CHAT_INFO_AT", "13"), /not loaded/);
assert.notEqual((await Bun.file(output).json()).action, "group_info");

await reset("GROUP");
await handler("GROUP_MEMBER_CHANGES");
await recorded("Group_Info_Member_Changes");
await handler("GROUP_DESCRIPTION");
await recorded("group-description-row");

// Info exposes only on-screen rows, and its navigation bar covers the top
// rows. Controls are paged to from either direction and pressed only once a
// hit test reaches them.
await reset();
await handler("CHAT_INFO_REPORT");
await recorded("info_report");
assert.ok((await Bun.file(output).json()).listOffset > 0);
await handler("CHAT_INFO_THEME");
await recorded("info_theme");
await reset("INFO_COVERED");
const covered = (await Bun.file(output).json()).listOffset;
await handler("CHAT_INFO_GROUP_ADD");
await recorded("info_group_add");
assert.ok((await Bun.file(output).json()).listOffset < covered, "pressed a covered row");

// Members are numbered from You (#1) across pages, skipping the action rows.
for (const index of [2, 9, 12]) {
  await reset("GROUP");
  await handler("GROUP_MEMBER_SELECT", String(index));
  await recorded(`member_options_${index}`);
}
await reset("GROUP");
await assert.rejects(handler("GROUP_MEMBER_SELECT", "1"), /no member options/);
assert.notEqual((await Bun.file(output).json()).action, "member_you");
await assert.rejects(handler("GROUP_MEMBER_SELECT", "13"), /not listed/);
await assert.rejects(handler("GROUP_MEMBER_INFO"), /Group member options/);
// Choosing another member closes the open options instead of reopening Info.
await handler("GROUP_MEMBER_SELECT", "3");
await recorded("member_options_3");
await handler("GROUP_MEMBER_SELECT", "5");
await recorded("member_options_5");
await handler("GROUP_MEMBER_ADMIN");
await recorded("member_admin_5");
await handler("GROUP_MEMBER_SELECT", "5");
await recorded("member_options_5");
await handler("GROUP_MEMBER_ADMIN");
await recorded("member_dismiss_admin_5");
await handler("GROUP_MEMBER_SELECT", "4");
await recorded("member_options_4");
await handler("GROUP_MEMBER_REMOVE");
await recorded("member_removed_4");
assert.deepEqual((await Bun.file(output).json()).removedMembers, [4]);
await reset("GROUP_PERMISSIONS_HIDDEN");
await handler("GROUP_PERMISSIONS");
await recorded("group_permissions");
assert.equal((await Bun.file(output).json()).phase, "GROUP_PERMISSIONS");
const permissionsOpen = await Bun.file(output).json();
await handler("GROUP_PERMISSIONS");
assert.deepEqual(await Bun.file(output).json(), permissionsOpen, "reopened Group permissions");
for (const mode of ["GROUP_PERMISSIONS_OCCUPIED", "GROUP_PERMISSIONS_BAD_LAYOUT"]) {
  await reset(mode);
  await assert.rejects(handler("GROUP_PERMISSIONS"), /unavailable/);
  assert.equal(
    (await Bun.file(output).json()).action,
    "group_info",
    `${mode} clicked an unknown row`,
  );
}
await reset("GROUP_PERMISSIONS_WRONG_PAGE");
await assert.rejects(handler("GROUP_PERMISSIONS"), /Group permissions.*did not open/);
assert.equal((await Bun.file(output).json()).phase, "GROUP_PERMISSIONS");
await reset();
await handler("SETTINGS_STORAGE");
await recorded("SettingsView_DataAndStorageUsageCell");
await handler("SETTINGS_ACCOUNT");
await recorded("SettingsView_AccountsCell");

// Both report choices are exercised ONLY against this local AppKit fixture.
for (const [action, control] of [
  ["CHAT_INFO_BLOCK", "block_confirmed"],
  ["CHAT_INFO_BLOCK_REPORT", "block_report_confirmed"],
] as const) {
  await reset("BLOCK_DIALOG");
  await handler(action);
  await recorded(control);
}
// With Info open, Info's Unblock row unblocks, with or without a confirmation.
for (const mode of ["UNBLOCK_INFO", "UNBLOCK_IMMEDIATE"]) {
  await reset(mode);
  await handler("CHAT_INFO_UNBLOCK");
  await recorded("unblock_confirmed");
  assert.equal((await Bun.file(output).json()).blocked, false);
}
// Chat › Block toggles whatever its title says, so the block chords leave an already
// blocked contact alone instead of unblocking it, and unblocking leaves an unblocked
// contact alone.
for (const action of ["CHAT_BLOCK", "CHAT_INFO_BLOCK", "CHAT_INFO_BLOCK_REPORT"] as const) {
  await reset("BLOCKED");
  await handler(action);
  const state = await Bun.file(output).json();
  assert.deepEqual(
    [state.action, state.blocked],
    ["READY", true],
    `${action} on a blocked contact`,
  );
}
await reset();
await handler("CHAT_INFO_UNBLOCK");
const unblocked = await Bun.file(output).json();
assert.deepEqual([unblocked.action, unblocked.blocked], ["READY", false]);

// Prefix navigation can already have opened Info, Theme, or Wallpaper. Child
// chords must continue from those views, without selecting a theme preset.
await reset();
await handler("CHAT_INFO");
await handler("CHAT_INFO_THEME");
await handler("CHAT_INFO_THEME_WALLPAPER");
await handler("CHAT_INFO_THEME_WALLPAPER_PHOTO");
await recorded("wallpaper_photo");
await handler("CHAT_INFO_THEME_BUBBLE");
await recorded("theme_bubble");
await handler("CHAT_INFO_THEME_WALLPAPER_COLOUR");
await recorded("wallpaper_colour");
await handler("CHAT_INFO_THEME_BUBBLE_SELECT", "23");
await recorded("bubble_2_3");
await assert.rejects(handler("CHAT_INFO_THEME_BUBBLE_SELECT", "99"), /unavailable/);
await handler("CHAT_INFO_THEME_WALLPAPER_SELECT", "2,3");
await recorded("wallpaper_2_3");

for (const [action, first, second] of [
  ["CHAT_PIN", "pin", "unpin"],
  ["CHAT_ARCHIVE", "archive", "unarchive"],
  ["CHAT_UNREAD", "mark_as_unread", "mark_as_read"],
  ["CALL_CAMERA", "turn_off_camera", "turn_on_camera"],
  ["CALL_MICROPHONE", "mute_microphone", "unmute_microphone"],
  ["CALL_HAND", "raise_hand", "lower_hand"],
  ["CALL_SCREEN_SHARE", "start_screen_sharing", "stop_screen_sharing"],
  ["CALL_PARTICIPANTS", "show_participants", "hide_participants"],
] as const) {
  await reset();
  await handler(action);
  await recorded(first);
  await handler(action);
  await recorded(second);
}
await reset("DISABLED");
await assert.rejects(handler("CALL_END"), /disabled/);
// Info is modal in WhatsApp, so search uses Info's own Search button, which closes
// Info and focuses the chat's search field once Info has gone.
await reset();
await handler("CHAT_INFO");
await handler("CHAT_INFO_SEARCH");
await recorded("info_search");
assert.equal((await Bun.file(output).json()).phase, "MAIN");
assert.equal((await Bun.file(output).json()).searchFocused, true);
// Search Chat toggles, so an open search bar is focused rather than closed.
await reset();
await handler("CHAT_SEARCH");
await handler("CHAT_SEARCH");
assert.equal((await Bun.file(output).json()).searchFocused, true);
// A search bar that is open but lost focus gets it back: nothing in the action
// opens the bar or closes Info, so there is no transition to wait for.
for (const action of ["CHAT_SEARCH", "CHAT_INFO_SEARCH"] as const) {
  await reset("SEARCH_UNFOCUSED");
  assert.equal((await Bun.file(output).json()).searchFocused, false);
  await handler(action);
  await recorded("search_focused");
  assert.equal((await Bun.file(output).json()).searchFocused, true);
}
await reset("MISSING");
await assert.rejects(handler("CHAT_DELETE"), /unavailable/);
await reset("AMBIGUOUS");
await assert.rejects(handler("CALL_REACT"), /ambiguous/);
await reset();
for (const action of ["CALL_DECLINE", "CALL_ACCEPT"] as const) {
  const before = await Bun.file(output).json();
  await assert.rejects(handler(action), /unavailable/);
  assert.deepEqual(
    await Bun.file(output).json(),
    before,
    `${action} acted without an incoming call`,
  );
}
await reset();
await handler("VIEW_PROFILE");
await recorded("SettingsView_ProfileCell");
// The additional dialog-navigation cases run in navigation.vm.test.ts.
// This suite covers every binding plus the chat, group, settings and call flows.
console.log(
  `whatsapp-app-targeting-ok: ${cases.length} chords, UI clicks, nested navigation, toggles, errors`,
);
