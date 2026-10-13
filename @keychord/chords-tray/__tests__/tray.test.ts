import { beforeEach, expect, mock, test } from "bun:test";
import type { TrayAction } from "../src/js/tray";

const nativeAction = mock(async (_type: string, _value: string, _action: string) => {});
const openAddon = mock(() => ({ default: { runTrayAction: nativeAction } }));
mock.module("tray-native-mock", openAddon);
// These tests load source without the bundler's native-addon plugin.
// Redirect its native import to a mocked JavaScript module.
Bun.plugin({
  name: "tray-native-mock",
  setup(builder) {
    builder.onLoad({ filter: /\/src\/js\/tray\.ts$/ }, async ({ path }) => ({
      loader: "ts",
      contents: (await Bun.file(path).text()).replace('"./tray.node"', '"tray-native-mock"'),
    }));
  },
});
const { default: buildHandler } = await import("../src/js/tray.ts");
const handler = buildHandler();
const { chords: bindings } = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, { name: string; "@input:tray"?: TrayAction; shortcut?: string }> };

beforeEach(() => nativeAction.mockClear());

test("every indexed binding preserves its index and mouse button with the ITEM type", async () => {
  for (let index = 1; index <= 9; index++) {
    for (const fromEnd of [false, true]) {
      for (const rightClick of [false, true]) {
        const chord = `=${fromEnd ? "-" : ""}${index}${rightClick ? ".," : ""}`;
        const expectedIndex = fromEnd ? -index : index - 1;
        const args = bindings[chord]["@input:tray"]!;
        expect(args).toEqual(
          rightClick ? ["ITEM", expectedIndex, "right"] : ["ITEM", expectedIndex],
        );
        await handler(...args);
        expect(nativeAction).toHaveBeenLastCalledWith(
          "ITEM",
          String(expectedIndex),
          rightClick ? "right" : "left",
        );
      }
    }
  }
  expect(nativeAction).toHaveBeenCalledTimes(36);
  expect(openAddon).toHaveBeenCalledTimes(1);
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
  ["=w", ["WIFI"]],
  ["=wv", ["WIFI", "TOGGLE"]],
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
    ([chord, binding]) => !chord.startsWith("?") && !binding["@input:tray"] && !binding.shortcut,
  );
  expect(placeholders).toEqual([]);
});

for (const index of [NaN, Infinity, -Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
  test(`rejects unsafe tray index ${index} before calling native code`, async () => {
    await expect(handler("ITEM", index)).rejects.toThrow("safe integer");
    expect(nativeAction).not.toHaveBeenCalled();
  });
}

test("native failures reach the caller", async () => {
  nativeAction.mockRejectedValueOnce(new Error("control unavailable"));
  await expect(handler("CONTROL_CENTER", "DISPLAY", "TRUE_TONE")).rejects.toThrow(
    "control unavailable",
  );
});
