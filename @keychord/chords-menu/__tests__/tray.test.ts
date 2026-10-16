import { beforeEach, expect, mock, test } from "bun:test";
import { chordPattern } from "@keychord/chordtest/patterns";
import type { TrayAction } from "../src/js/tray";

const nativeAction = mock(async (_type: string, _value: string, _action: string) => {});
const nativeSelection = mock(
  async (
    _app: string | undefined,
    _scope: string,
    _index: string,
    _steps: string,
    _click: string,
  ) => {},
);
const openAddon = mock(() => ({
  default: { runTrayAction: nativeAction, runMenuBarAction: nativeSelection },
}));
// The chordtest preload stubs the handler's native import; replace it with the mocked addon.
mock.module("../src/js/menu.node", openAddon);
const { default: buildHandler } = await import("../src/js/tray.ts");
const handler = buildHandler();
const { default: buildSelectionHandler, parseMenuBarSelection } =
  await import("../src/js/selection");
const select = buildSelectionHandler();
const { chords: bindings } = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as {
  chords: Record<
    string,
    {
      name: string;
      "@input:tray"?: TrayAction;
      "@keydown:select"?: ["KEYDOWN", string];
      "@input:select"?: ["INPUT", string];
      "@input:visibility"?: [];
      "@input:menu"?: unknown;
      shortcut?: string;
    }
  >;
};
const selectionBindings = Object.entries(bindings).filter(
  ([, binding]) => binding["@keydown:select"],
);

async function dispatch(sequence: string, key = sequence.at(-1)!, repeat = false) {
  const matches = selectionBindings.flatMap(([pattern, binding]) => {
    const match = chordPattern(pattern).exec(sequence);
    return match ? [{ binding, capture: match[1] }] : [];
  });
  expect(matches).toHaveLength(1);
  const { binding, capture } = matches[0];
  expect(binding["@keydown:select"]).toEqual(["KEYDOWN", "$1"]);
  expect(binding["@input:select"]).toEqual(["INPUT", "$1"]);
  await select.call({ event: { type: "keydown", key, repeat } }, "KEYDOWN", capture);
}

beforeEach(() => {
  nativeAction.mockClear();
  nativeSelection.mockClear();
});

test("bare indexes select tray icons and explicit menu/tray prefixes keep their scope", async () => {
  for (const [prefix, scope] of [
    ["", "TRAY"],
    ["[", "MENU"],
    ["]", "TRAY"],
  ]) {
    for (let index = 1; index <= 9; index++) {
      for (const fromEnd of [false, true]) {
        for (const rightClick of [false, true]) {
          await dispatch("=" + prefix + (fromEnd ? "-" : "") + index + (rightClick ? "," : "."));
          expect(nativeSelection).toHaveBeenLastCalledWith(
            undefined,
            scope,
            String(fromEnd ? -index : scope === "TRAY" ? index - 1 : index),
            "",
            rightClick ? "RIGHT" : "LEFT",
          );
        }
      }
    }
  }
  expect(openAddon).toHaveBeenCalledTimes(1);
});

test("=78. previews 7, then 8, and clicks 8 once", async () => {
  for (const sequence of ["=7", "=78", "=78."]) await dispatch(sequence);
  await select.call({ event: { type: "keydown", key: "CapsLock", repeat: false } }, "INPUT", "78.");
  expect(nativeSelection.mock.calls).toEqual([
    [undefined, "TRAY", "6", "", ""],
    [undefined, "TRAY", "7", "", ""],
    [undefined, "TRAY", "7", "", "LEFT"],
  ]);
});

test("Apple is zero; l/r uses the full number and bracket steps keep the selected scope", async () => {
  for (const [sequence, scope, index, steps] of [
    ["=0", "MENU", "0", ""],
    ["=[0", "MENU", "0", ""],
    ["=10l", "TRAY", "9", ""],
    ["=10l]", "TRAY", "9", "]"],
    ["=10l][", "TRAY", "9", "]["],
    ["=10r", "TRAY", "-10", ""],
    ["=10r]", "TRAY", "-10", "]"],
    ["=10r[", "TRAY", "-10", "["],
    ["=-78", "TRAY", "-8", ""],
    ["=]1", "TRAY", "0", ""],
    ["=]10l", "TRAY", "9", ""],
    ["=]-1", "TRAY", "-1", ""],
    ["=[-1", "MENU", "-1", ""],
  ]) {
    await dispatch(sequence);
    expect(nativeSelection).toHaveBeenLastCalledWith(undefined, scope, index, steps, "");
  }
  await dispatch("=0.");
  expect(nativeSelection).toHaveBeenLastCalledWith(undefined, "MENU", "0", "", "LEFT");
});

test("Backspace restores a selection without clicking; repeat and modifier events cannot click", async () => {
  await dispatch("=78.");
  nativeSelection.mockClear();
  await dispatch("=78.", ".", true);
  await dispatch("=78.", "Shift");
  expect(nativeSelection).not.toHaveBeenCalled();
  await dispatch("=78", "Backspace");
  await dispatch("=7", "Backspace");
  expect(nativeSelection.mock.calls).toEqual([
    [undefined, "TRAY", "7", "", ""],
    [undefined, "TRAY", "6", "", ""],
  ]);
});

test("CLI completion clicks once and passes Chord's captured application", async () => {
  await select.call({ event: null }, "INPUT", "78");
  expect(nativeSelection).not.toHaveBeenCalled();
  await select.call({ event: null, focusedAppId: "dev.keychord.fixture" }, "INPUT", "[2.");
  expect(nativeSelection).toHaveBeenCalledTimes(1);
  expect(nativeSelection).toHaveBeenCalledWith("dev.keychord.fixture", "MENU", "2", "", "LEFT");
});

test("invalid full indexes cannot click; letters, notch, and named actions never match numeric selection", async () => {
  for (const sequence of ["-0.", "]0.", "10.", "0].", "9007199254740992l."]) {
    await expect(select.call({ event: null }, "INPUT", sequence)).rejects.toThrow(
      "valid menu bar index",
    );
  }
  expect(nativeSelection).not.toHaveBeenCalled();
  for (const sequence of [
    "=00",
    "=01",
    "=010",
    "=f",
    "=wi",
    "==c",
    "=7.,",
    "=[f.",
    "=/f.",
    "=-",
    "=]",
    "=[",
  ]) {
    expect(
      selectionBindings.some(([pattern]) => chordPattern(pattern).test(sequence)),
      sequence,
    ).toBe(false);
  }
  expect(parseMenuBarSelection("1[.")).toMatchObject({
    scope: "TRAY",
    index: 0,
    steps: "[",
    clickType: "LEFT",
  });
  expect(parseMenuBarSelection("]1r].")).toMatchObject({
    scope: "TRAY",
    index: -1,
    steps: "]",
    clickType: "LEFT",
  });
});

test("bare minus clicks the notch only when input completes", async () => {
  expect(bindings["=-"]["@input:tray"]).toEqual(["NOTCH"]);
  expect(bindings["=-"]["@keydown:select"]).toBeUndefined();
  await handler("NOTCH");
  expect(nativeAction).toHaveBeenCalledWith("NOTCH", "", "");
});

const controlCenterBindings: [string, TrayAction][] = [
  ["=c", ["CONTROL_CENTER"]],
  ["=cd", ["CONTROL_CENTER", "DISPLAY"]],
  ["=cd-", ["CONTROL_CENTER", "DISPLAY", "DECREASE"]],
  ["=cd=", ["CONTROL_CENTER", "DISPLAY", "INCREASE"]],
  ["=cd.", ["CONTROL_CENTER", "DISPLAY", "CLICK"]],
  ["=cdd", ["CONTROL_CENTER", "DISPLAY", "DARK_MODE"]],
  ["=cdn", ["CONTROL_CENTER", "DISPLAY", "NIGHT_SHIFT"]],
  ["=cdt", ["CONTROL_CENTER", "DISPLAY", "TRUE_TONE"]],
  ["=cds", ["CONTROL_CENTER", "DISPLAY", "SETTINGS"]],
  ["=cs", ["CONTROL_CENTER", "SOUND"]],
  ["=cs-", ["CONTROL_CENTER", "SOUND", "DECREASE"]],
  ["=cs=", ["CONTROL_CENTER", "SOUND", "INCREASE"]],
  ["=cs.", ["CONTROL_CENTER", "SOUND", "CLICK"]],
];

for (const [chord, args] of controlCenterBindings) {
  test(`${chord} routes the configured Control Center command`, async () => {
    expect(bindings[chord]["@input:tray"]).toEqual(args);
    await handler(...bindings[chord]["@input:tray"]!);
    expect(nativeAction).toHaveBeenCalledWith(args[0], args[1] ?? "", args[2] ?? "");
  });
}

test("all Control Center entries have executable bindings", () => {
  const entries = Object.entries(bindings).filter(([, binding]) =>
    binding.name.startsWith("Tray: Control Center"),
  );
  expect(entries.map(([chord]) => chord).sort()).toEqual(
    controlCenterBindings.map(([chord]) => chord).sort(),
  );
  expect(bindings["=cd."].name).toEndWith("Click");
  expect(bindings["=cds"].name).toEndWith("Settings");
});

for (const [chord, args] of [
  ["=p", ["BATTERY"]],
  ["=t", ["DATE_TIME"]],
  ["=wi", ["WIFI"]],
  ["=wiv", ["WIFI", "TOGGLE"]],
] satisfies [string, TrayAction][]) {
  test(`${chord} routes its system tray command`, async () => {
    expect(bindings[chord]["@input:tray"]).toEqual(args);
    await handler(...bindings[chord]["@input:tray"]!);
    expect(nativeAction).toHaveBeenCalledWith(args[0], args[1] ?? "", "");
  });
}

test("Spotlight has a shortcut and every non-category chord has an action", () => {
  expect(bindings["=s"].shortcut).toBe("cmd+space");
  const placeholders = Object.entries(bindings).filter(
    ([chord, binding]) =>
      !chord.startsWith("?") &&
      !binding["@input:tray"] &&
      !binding["@keydown:select"] &&
      !binding["@input:visibility"] &&
      !binding["@input:menu"] &&
      !binding.shortcut,
  );
  expect(placeholders).toEqual([]);
});

for (const index of [NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`rejects unsafe tray index ${index} before calling native code`, async () => {
    await expect(handler("ITEM", index)).rejects.toThrow("safe integer");
    await expect(handler("HOVER", index)).rejects.toThrow("safe integer");
    expect(nativeAction).not.toHaveBeenCalled();
  });
}

test("native failures reach the caller", async () => {
  nativeAction.mockRejectedValueOnce(new Error("control unavailable"));
  await expect(handler("CONTROL_CENTER", "DISPLAY", "TRUE_TONE")).rejects.toThrow(
    "control unavailable",
  );
});

test("visibility chord invokes its own handler without colliding with volume chords", () => {
  expect(bindings["=v"]["@input:visibility"]).toEqual([]);
  expect(bindings["=vu"].shortcut).toBe("AudioVolumeUp");
  expect(bindings["=vd"].shortcut).toBe("AudioVolumeDown");
  expect(bindings["=vm"].shortcut).toBe("AudioVolumeMute");
});
