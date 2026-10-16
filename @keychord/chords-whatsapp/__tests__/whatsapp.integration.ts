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
    .filter(
      ([chord, binding]) =>
        !chord.startsWith("?") && Object.keys(binding).some((key) => key !== "name"),
    )
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
  if (scenario.action === "CHAT_OPEN_WINDOW") {
    assert.equal((await Bun.file(output).json()).chatWindowOpen, true);
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
console.log(
  `whatsapp-app-targeting-ok: ${cases.length} chords, UI clicks, nested navigation, toggles, errors`,
);
