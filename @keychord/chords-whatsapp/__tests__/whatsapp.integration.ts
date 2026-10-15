import assert from "node:assert/strict";
import builtHandler from "../js/whatsapp.js";
import { waitFor } from "@keychord/chordtest/macos";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { cases } from "./cases";

requireMacOSVM();
const buildHandler = builtHandler as typeof import("../src/js/whatsapp").default;
const [targetId, output, coverId, coverOutput] = Bun.argv.slice(2);
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
  Object.keys(chords)
    .filter((key) => !key.startsWith("?"))
    .sort(),
  cases.map((test) => test.chord).sort(),
);
for (const scenario of cases) {
  await reset();
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
  assert.deepEqual(
    await Bun.file(coverOutput).json(),
    before,
    `${scenario.chord} changed the covering app`,
  );
  console.log(`whatsapp-chord-ok ${scenario.chord}`);
}

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
await handler("VIEW_PROFILE");
await recorded("SettingsView_ProfileCell");
console.log(
  `whatsapp-app-targeting-ok: ${cases.length} chords, UI clicks, nested navigation, toggles, errors`,
);
