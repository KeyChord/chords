import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chordPattern } from "@keychord/chordtest/patterns";
import type { MenuAction, MenuArguments } from "../src/js/menu";
import { afterEach, expect, test, vi } from "vite-plus/test";

type Binding = {
  name: string;
  "@input:menu"?: MenuArguments;
  "@keydown:select"?: [string, string];
  "@input:tray"?: unknown[];
  "@input:visibility"?: [];
  shortcut?: string;
};
function loadBindings(path: string): Record<string, Binding> {
  return JSON.parse(
    execFileSync(
      "bun",
      ["-e", "console.log(JSON.stringify(Bun.TOML.parse(await Bun.stdin.text()).chords))"],
      {
        input: readFileSync(new URL(path, import.meta.url), "utf8"),
        encoding: "utf8",
      },
    ),
  );
}
const bindings = loadBindings("../chords/macos.toml");
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
  vi.restoreAllMocks();
  vi.doUnmock("../src/js/menu.node");
  vi.resetModules();
});

test.each([
  ["=[f.", "by-letters", "f"],
  ["=[w.", "by-letters", "w"],
  ["=[c.", "by-letters", "c"],
  ["=[hh.", "by-letters", "hh"],
  ["=[zo12.", "by-letters", "zo12"],
  ["=[z-o2.", "by-letters", "z-o2"],
  ["=/Zoom", "search", "Zoom"],
  ["=/Window > Move & Resize", "search", "Window > Move & Resize"],
  ["=/100% … 日本語", "search", "100% … 日本語"],
])("%s dispatches %s %s with the captured application", async (sequence, action, value) => {
  const nativeAction = vi.fn().mockResolvedValue(undefined);
  vi.doMock("../src/js/menu.node", () => ({ default: { runMenuAction: nativeAction } }));
  const { default: buildMenuHandler } = await import("../src/js/menu.ts");
  const menu = buildMenuHandler();
  const [resolvedAction, argument] = menuAction(sequence);
  expect([resolvedAction, argument]).toEqual([action, value]);
  const context = { focusedAppId: "dev.keychord.fixture" };
  if (resolvedAction === "by-index") await menu.call(context, "by-index", argument);
  else {
    if (resolvedAction === "search") await menu.call(context, "search", argument);
    else await menu.call(context, "by-letters", argument);
  }
  expect(nativeAction).toHaveBeenCalledExactlyOnceWith("dev.keychord.fixture", action, value);
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
    ].map((sequence) => [sequence, "tray"]),
    ..."abcdefghijklmnopqrstuvwxyz".split("").map((letter) => ["=[" + letter + ".", "menu"]),
    ["=[hh.", "menu"],
    ["=[z-o2.", "menu"],
  ]) {
    const matches = [
      ...menuBindings.map(([pattern]) => ({ pattern, owner: "menu" })),
      ...Object.entries(trayBindings)
        .filter(
          ([, binding]) =>
            binding["@keydown:select"] ||
            binding["@input:tray"] ||
            binding["@input:visibility"] ||
            binding.shortcut,
        )
        .map(([pattern]) => ({ pattern, owner: "tray" })),
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
  const nativeAction = vi.fn().mockResolvedValue(undefined);
  vi.doMock("../src/js/menu.node", () => ({ default: { runMenuAction: nativeAction } }));
  const { default: buildMenuHandler } = await import("../src/js/menu");
  const menu = buildMenuHandler();
  const windows = Object.entries(bindings).filter(
    ([chord]) => chord.startsWith("=w") && chord !== "=wi" && chord !== "=wiv",
  );
  expect(windows.length).toBeGreaterThan(15);
  for (const [chord, binding] of windows) {
    const [action, path] = binding["@input:menu"]!;
    expect(action).toBe("by-path");
    if (action !== "by-path") throw new Error("Expected a Window-menu path");
    expect(binding.shortcut).toBeUndefined();
    expect(path[0]).toBe("Window");
    await menu.call({ focusedAppId: "dev.fixture" }, "by-path", path);
    expect(nativeAction).toHaveBeenLastCalledWith("dev.fixture", "by-path", JSON.stringify(path));
    expect(chordPattern(chord).test(chord)).toBe(true);
  }
  expect(bindings["=w"]["@input:menu"]).toEqual(["by-path", ["Window"]]);
});
