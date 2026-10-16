import { afterEach, expect, mock, test } from "bun:test";
import { chordPattern } from "@keychord/chordtest/patterns";
import buildMenuHandler, { type MenuAction, type MenuArguments } from "../src/js/menu";

type Binding = {
  name: string;
  "@input:menu"?: MenuArguments;
  "@keydown:select"?: [string, string];
  "@input:tray"?: unknown[];
  "@input:visibility"?: [];
  shortcut?: string;
};
const bindings = (
  Bun.TOML.parse(await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text()) as {
    chords: Record<string, Binding>;
  }
).chords;
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
  ["=[f.", "BY_LETTERS", "f"],
  ["=[w.", "BY_LETTERS", "w"],
  ["=[c.", "BY_LETTERS", "c"],
  ["=[hh.", "BY_LETTERS", "hh"],
  ["=[zo12.", "BY_LETTERS", "zo12"],
  ["=[z-o2.", "BY_LETTERS", "z-o2"],
  ["=/Zoom", "SEARCH", "Zoom"],
  ["=/Window > Move & Resize", "SEARCH", "Window > Move & Resize"],
  ["=/100% … 日本語", "SEARCH", "100% … 日本語"],
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
      "=0",
      "=1",
      "=78.",
      "=10l].",
      "=10r[.",
      "=-1.",
      "=-10l.",
      "=[0.",
      "=[1.",
      "=[-1.",
      "=]1.",
      "=]-1.",
      "=c",
      "=wi",
      "=s",
      "=v",
      "=-",
    ].map((sequence) => [sequence, "TRAY"]),
    ..."abcdefghijklmnopqrstuvwxyz".split("").map((letter) => ["=[" + letter + ".", "MENU"]),
    ["=[hh.", "MENU"],
    ["=[z-o2.", "MENU"],
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
  for (const sequence of ["=f", "=wi", "=[f", "=[hh", "=/", "=[H.", "=00", "=01", "=010", "==c"]) {
    expect(menuBindings.some(([pattern]) => chordPattern(pattern).test(sequence))).toBe(false);
  }
  expect(trayBindings["?=0"].name).toContain("Apple");
});

test("Window-menu chords invoke exact menu paths and share the unified menu-bar addon", async () => {
  const nativeAction = mock().mockResolvedValue(undefined);
  mock.module("../src/js/menu.node", () => ({ default: { runMenuAction: nativeAction } }));
  const menu = buildMenuHandler();
  const windows = Object.entries(bindings).filter(
    ([chord]) => chord.startsWith("=w") && chord !== "=wi" && chord !== "=wiv",
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
  expect(bindings["=w"]["@input:menu"]).toEqual(["BY_PATH", ["Window"]]);
});
