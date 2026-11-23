import { afterEach, expect, mock, test } from "bun:test";
import {
  chordPattern,
  expandPlaceholders,
  type ChordPlaceholders,
} from "@keychord/chordtest/patterns";
import buildMenuHandler, { type MenuAction, type MenuArguments } from "../src/js/menu";

type Binding = {
  name: string;
  "@input:menu"?: MenuArguments;
  "@keydown:select"?: [string, string];
  "@input:tray"?: unknown[];
  "@input:visibility"?: [];
  shortcut?: string;
};
const { chords, placeholders } = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, Binding>; placeholders: ChordPlaceholders };
const bindings = Object.fromEntries(
  Object.entries(chords).map(([key, binding]) => [expandPlaceholders(key, placeholders), binding]),
);
const trayBindings = bindings;
const menuBindings = Object.entries(bindings).filter(([, binding]) => binding["@input:menu"]);

function menuAction(sequence: string): [MenuAction, string] {
  const matches = menuBindings.flatMap(([pattern, binding]) => {
    const match = chordPattern(pattern).exec(sequence);
    if (!match) return [];
    const [action, argument] = binding["@input:menu"]!;
    if (typeof argument !== "string") throw new Error("Expected a text capture binding");
    return [
      [action, argument.replace(/\$(\d+)/g, (_, index) => match[Number(index)])] as [
        MenuAction,
        string,
      ],
    ];
  });
  expect(matches).toHaveLength(1);
  return matches[0];
}

afterEach(() => {
  mock.restore();
});

test.each([
  [";b[f.", "BY_LETTERS", "f"],
  [";b[w.", "BY_LETTERS", "w"],
  [";b[c.", "BY_LETTERS", "c"],
  [";b[hh.", "BY_LETTERS", "hh"],
  [";b[zo12.", "BY_LETTERS", "zo12"],
  [";b[z-o2.", "BY_LETTERS", "z-o2"],
  [";b/Zoom", "SEARCH", "Zoom"],
  [";b/Window > Move & Resize", "SEARCH", "Window > Move & Resize"],
  [";b/100% … 日本語", "SEARCH", "100% … 日本語"],
])("%s dispatches %s %s with the captured application", async (sequence, action, value) => {
  const nativeAction = mock().mockResolvedValue(undefined);
  mock.module("../src/js/menu.node", () => ({ default: { runMenuAction: nativeAction } }));
  const menu = buildMenuHandler();
  const [resolvedAction, argument] = menuAction(sequence);
  expect([resolvedAction, argument]).toEqual([action, value]);
  const context = { focusedAppId: "dev.keychord.fixture" };
  if (resolvedAction === "BY_INDEX") await menu.call(context, "BY_INDEX", argument);
  else {
    if (resolvedAction === "SEARCH") await menu.call(context, "SEARCH", argument);
    else await menu.call(context, "BY_LETTERS", argument);
  }
  expect(nativeAction).toHaveBeenCalledTimes(1);
  expect(nativeAction).toHaveBeenCalledWith("dev.keychord.fixture", action, value);
});

test("tray selection, menu indexes, letter queries, and named actions have distinct bindings", () => {
  for (const [sequence, owner] of [
    ...[
      ";b0",
      ";b1",
      ";b78.",
      ";b10l].",
      ";b10r[.",
      ";b-1.",
      ";b-10l.",
      ";b[0.",
      ";b[1.",
      ";b[-1.",
      ";b]1.",
      ";b]-1.",
      ";bc",
      ";bcw",
      ";bv",
      ";b-",
    ].map((sequence) => [sequence, "TRAY"]),
    ..."abcdefghijklmnopqrstuvwxyz".split("").map((letter) => [";b[" + letter + ".", "MENU"]),
    [";b[hh.", "MENU"],
    [";b[z-o2.", "MENU"],
  ]) {
    const matches = [
      ...menuBindings.map(([pattern]) => ({ pattern, owner: "MENU" })),
      ...Object.entries(trayBindings)
        .filter(
          ([, binding]) =>
            binding["@keydown:select"] ||
            binding["@input:tray"] ||
            binding["@input:visibility"] ||
            binding.shortcut,
        )
        .map(([pattern]) => ({ pattern, owner: "TRAY" })),
    ].filter(({ pattern }) => chordPattern(pattern).test(sequence));
    expect(
      matches.map((match) => match.owner),
      sequence,
    ).toEqual([owner]);
  }
  for (const sequence of [
    ";bf",
    ";bcw",
    ";b[f",
    ";b[hh",
    ";b/",
    ";b[H.",
    ";b00",
    ";b01",
    ";b010",
    ";b=c",
  ]) {
    expect(menuBindings.some(([pattern]) => chordPattern(pattern).test(sequence))).toBe(false);
  }
  expect(trayBindings["?;b0"].name).toContain("Apple");
});

// `;bw` is the window scope: Window-menu actions plus these application shortcuts.
const applicationShortcuts: Record<string, string> = {
  ";bwq": "cmd+q",
  ";bwh": "cmd+h",
  ";bwm": "cmd+m",
};

test(";bwq, ;bwh and ;bwm quit, hide and minimize with the application shortcuts", () => {
  for (const [chord, shortcut] of Object.entries(applicationShortcuts))
    expect(bindings[chord]).toEqual({ name: expect.any(String), shortcut });
  // Force Quit uses ;bq.
  expect(bindings[";bq"]["@input:menu"]).toEqual(["BY_PATH", ["Apple", "Force Quit…"]]);
  for (const chord of [";bh", ";bm", ";bs", ";bwi", ";bwiv", ";bws["])
    expect(bindings[chord]).toBeUndefined();
});

test("Window-menu chords invoke exact menu paths and share the unified menu-bar addon", async () => {
  const nativeAction = mock().mockResolvedValue(undefined);
  mock.module("../src/js/menu.node", () => ({ default: { runMenuAction: nativeAction } }));
  const menu = buildMenuHandler();
  const windows = Object.entries(bindings).filter(
    ([chord]) => chord.startsWith(";bw") && !(chord in applicationShortcuts),
  );
  expect(windows.length).toBeGreaterThan(15);
  for (const [chord, binding] of windows) {
    const [action, path] = binding["@input:menu"]!;
    expect(action).toBe("BY_PATH");
    if (action !== "BY_PATH") throw new Error("Expected a Window-menu path");
    expect(binding.shortcut).toBeUndefined();
    expect(path[0]).toBe("Window");
    await menu.call({ focusedAppId: "dev.fixture" }, "BY_PATH", path);
    expect(nativeAction).toHaveBeenLastCalledWith("dev.fixture", "BY_PATH", JSON.stringify(path));
    expect(chordPattern(chord).test(chord)).toBe(true);
  }
  expect(bindings[";bw"]["@input:menu"]).toEqual(["BY_PATH", ["Window"]]);
});
