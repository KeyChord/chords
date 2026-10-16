import assert from "node:assert/strict";
import builtHandler from "../js/navigation.js";
import builtWhatsApp from "../../chords-whatsapp/js/whatsapp.js";
import type { NavigationAction } from "../src/js/navigation";
import { chordPattern } from "@keychord/chordtest/patterns";
import { waitFor } from "@keychord/chordtest/macos";
import { requireMacOSVM } from "@keychord/chordtest/runtime";

requireMacOSVM();
const [targetId, output, coverId, coverOutput] = Bun.argv.slice(2);
const navigation = (builtHandler as typeof import("../src/js/navigation").default)();
const buildWhatsApp =
  builtWhatsApp as typeof import("../../chords-whatsapp/src/js/whatsapp").default;
const handler = buildWhatsApp(targetId);
const cover = buildWhatsApp(coverId);
const { chords } = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, { "@input:navigation"?: [NavigationAction, string?] }> };

async function navigate(action: NavigationAction, index?: string) {
  const input =
    action === "PREVIOUS"
      ? "[["
      : action === "NEXT"
        ? "]]"
        : action === "CLOSE"
          ? "[x"
          : `]${index}`;
  const bindings = Object.entries(chords).filter(
    ([key]) => !key.startsWith("?") && chordPattern(key).test(input),
  );
  assert.equal(bindings.length, 1);
  const [key, binding] = bindings[0];
  const args = binding["@input:navigation"]!;
  await navigation.call(
    { focusedAppId: targetId },
    args[0],
    args[1] === "$1" ? chordPattern(key).exec(input)![1] : args[1],
  );
}

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

// Exercise the shipped global bindings with a different app covering WhatsApp.
for (const [mode, action, control] of [
  ["GROUP_PICKER", "NEXT", "group_next"],
  ["GROUP_SETUP", "PREVIOUS", "group_back"],
  ["NAVIGATION_PREVIEW", "NEXT", "navigation_next"],
  ["NAVIGATION_PREVIEW", "PREVIOUS", "navigation_previous"],
] as const) {
  await reset(mode);
  const coverSequence = (await Bun.file(coverOutput).json()).sequence;
  await cover("VIEW_CHATS");
  await waitFor(async () => {
    const state = await Bun.file(coverOutput).json();
    return state.sequence > coverSequence && state.action === "chats" && state.active === true
      ? true
      : undefined;
  });
  const before = await Bun.file(coverOutput).json();
  await navigate(action);
  await recorded(control);
  assert.deepEqual(
    await Bun.file(coverOutput).json(),
    before,
    "global chord acted on the covering app",
  );
}

await navigationChecks();
for (const index of ["1", "4", "10", "12"]) {
  await reset("NAVIGATION_OPTIONS");
  await navigate("OPTION", index);
  await recorded(`option_${index}`);
}
for (const [mode, index, error] of [
  ["NAVIGATION_OPTIONS", "13", /unavailable/],
  ["NAVIGATION_OPTION_DISABLED", "4", /disabled/],
] as const) {
  await reset(mode);
  const before = await Bun.file(output).json();
  await assert.rejects(navigate("OPTION", index), error);
  assert.deepEqual(await Bun.file(output).json(), before);
}

await reset("NAVIGATION_STACK");
await navigate("PREVIOUS");
await recorded("navigation_inner_closed");
await navigate("CLOSE");
await recorded("navigation_closed");
await reset("NAVIGATION_STACK");
await navigate("CLOSE");
await recorded("navigation_closed");
await reset("NAVIGATION_HINTS");
await navigate("CLOSE");
await recorded("navigation_previous");
await reset("NAVIGATION_ESCAPE");
await navigate("CLOSE");
await recorded("navigation_closed");
await reset("NAVIGATION_ESCAPE_IGNORED");
const ignored = await Bun.file(output).json();
await assert.rejects(navigate("CLOSE"), /did not dismiss/);
assert.deepEqual(await Bun.file(output).json(), ignored);
await reset();
const main = await Bun.file(output).json();
await assert.rejects(navigate("CLOSE"), /no dialog/);
assert.deepEqual(await Bun.file(output).json(), main, "closed a normal application window");

const whatsapp = Bun.TOML.parse(
  await Bun.file(
    new URL("../../chords-whatsapp/chords/net/whatsapp/WhatsApp/macos.toml", import.meta.url),
  ).text(),
) as { chords: Record<string, unknown> };
for (const key of ["g[", "g]", "cgc[", "cgc]"]) assert.equal(whatsapp.chords[key], undefined);
console.log(
  "global-navigation-ok: WhatsApp groups, dialogs, hints, options, nested close, targeted Escape",
);

async function navigationChecks() {
  await reset();
  await handler("CHAT_GROUP_CREATE");
  await handler("CHAT_GROUP_SELECT", "1");
  await recorded("group_member_1");
  await handler("CHAT_GROUP_SELECT", "12");
  await recorded("group_member_12");
  const selected = await Bun.file(output).json();
  await assert.rejects(handler("CHAT_GROUP_SELECT", "13"), /not loaded/);
  assert.deepEqual(await Bun.file(output).json(), selected);
  await navigate("NEXT");
  await recorded("group_next");
  await assert.rejects(navigate("NEXT"), /unavailable/);
  await navigate("PREVIOUS");
  await recorded("group_back");
  await reset();
  await assert.rejects(navigate("PREVIOUS"), /unavailable/);

  // Dialog navigation must ignore the background page and native titlebar close
  // button, including when an inner dialog replaces an outer navigation scope.
  for (const [mode, action, control] of [
    ["NAVIGATION_PREVIEW", "NEXT", "navigation_next"],
    ["NAVIGATION_PREVIEW", "PREVIOUS", "navigation_previous"],
    ["NAVIGATION_NESTED", "NEXT", "navigation_next"],
    ["NAVIGATION_NESTED", "PREVIOUS", "navigation_previous"],
    ["NAVIGATION_WINDOW", "NEXT", "navigation_next"],
    ["NAVIGATION_WINDOW", "PREVIOUS", "navigation_previous"],
    ["NAVIGATION_DEFAULT", "NEXT", "navigation_next"],
    ["NAVIGATION_HINTS", "NEXT", "navigation_next"],
    ["NAVIGATION_HINTS", "PREVIOUS", "navigation_previous"],
    ["NAVIGATION_LOCALIZED", "NEXT", "navigation_next"],
    ["NAVIGATION_LOCALIZED", "PREVIOUS", "navigation_previous"],
    ["NAVIGATION_SYMBOLS", "NEXT", "navigation_next"],
    ["NAVIGATION_SYMBOLS", "PREVIOUS", "navigation_previous"],
    ["NAVIGATION_MISLEADING", "NEXT", "navigation_next"],
    ["NAVIGATION_MISLEADING", "PREVIOUS", "navigation_previous"],
  ] as const) {
    await reset(mode);
    await navigate(action);
    await recorded(control);
  }
  for (const [mode, error] of [
    ["NAVIGATION_DISABLED", /disabled/],
    ["NAVIGATION_AMBIGUOUS", /ambiguous/],
    ["NAVIGATION_EMPTY", /unavailable/],
    ["NAVIGATION_BODY", /unavailable/],
    ["NAVIGATION_PARENT_DEFAULT", /unavailable/],
  ] as const) {
    await reset(mode);
    const before = await Bun.file(output).json();
    await assert.rejects(navigate("NEXT"), error);
    assert.deepEqual(await Bun.file(output).json(), before, `${mode} invoked a control`);
  }
}
