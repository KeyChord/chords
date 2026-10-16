import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chordPattern } from "@keychord/chordtest/patterns";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { parseWindowDimensions, type WindowAction } from "../src/js/utils/window-dimensions";

const divisor = (value: number) => ({ value, unit: "divisor" });
const fraction = (value: number) => ({ value, unit: "fraction" });
const pixels = (value: number) => ({ value, unit: "pixels" });

test.each([
  ["22", { width: divisor(2), height: divisor(2) }],
  ["2", { width: divisor(2) }],
  ["-1", { width: fraction(2) }],
  ["2-1", { width: divisor(2), height: fraction(2) }],
  ["-2-1", { width: fraction(3), height: fraction(2) }],
  ["-1 2", { width: fraction(2), height: divisor(2) }],
  ["h1", { height: divisor(1) }],
  ["h-1", { height: fraction(2) }],
  ["200x", { width: pixels(200) }],
  ["200x200", { width: pixels(200), height: pixels(200) }],
  ["200x200x", { width: pixels(200), height: pixels(200) }],
  ["200.5x100.25", { width: pixels(200.5), height: pixels(100.25) }],
  ["h200x", { height: pixels(200) }],
])("size %s preserves the supplied units and omitted dimension", (input, expected) => {
  expect(parseWindowDimensions("SIZE", input)).toEqual(expected);
});

test.each([
  ["22", { width: divisor(2), height: divisor(2) }],
  ["00", { width: fraction(0), height: fraction(0) }],
  ["2", { width: divisor(2) }],
  ["-1", { width: divisor(-1) }],
  ["-2-2", { width: divisor(-2), height: divisor(-2) }],
  ["-24", { width: divisor(-2), height: divisor(4) }],
  ["h-2", { height: divisor(-2) }],
  ["r1", { width: divisor(1), right: true }],
  ["r22", { width: divisor(2), height: divisor(2), right: true }],
  ["r-2", { width: divisor(-2), right: true }],
  ["-200x-100", { width: pixels(-200), height: pixels(-100) }],
  ["r200x", { width: pixels(200), right: true }],
  ["h0x", { height: pixels(0) }],
])("position %s handles signed offsets and anchors", (input, expected) => {
  expect(parseWindowDimensions("POSITION", input)).toEqual(expected);
});

test.each([
  "",
  "h",
  "h22",
  "123",
  "200",
  "2junk",
  ".",
  "200xx",
  "200x200x2",
  "1e2x",
  "Infinityx",
  "9007199254740992x",
  "rh2",
  ".5",
  "2.5",
  "-.5",
  "-0",
])("%s is rejected before any native action", (input) => {
  for (const action of ["SIZE", "POSITION"] as const) {
    expect(() => parseWindowDimensions(action, input)).toThrow(TypeError);
  }
});
test.each(["0", ".0", "20", ".5", "-.5", "0x", "200x0", "h-200x", "r1"])(
  "invalid size %s is rejected",
  (input) => expect(() => parseWindowDimensions("SIZE", input)).toThrow(TypeError),
);

afterEach(() => {
  vi.doUnmock("../src/js/window.node");
  vi.resetModules();
});

const definition = JSON.parse(
  execFileSync(
    "bun",
    ["-e", "console.log(JSON.stringify(Bun.TOML.parse(await Bun.stdin.text())))"],
    {
      input: readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8"),
      encoding: "utf8",
    },
  ),
) as {
  on: Record<string, { file: string }>;
  chords: Record<string, { "@input:window"?: [WindowAction, string]; shortcut?: string }>;
};

test.each(["/ws22", "/ws-1", "/wsh1", "/ws200x200", "/wp22", "/wpr1", "/wp-1", "/wph-2"])(
  "%s dispatches the TOML capture to the native handler with the captured app",
  async (input) => {
    const native = vi.fn().mockResolvedValue(undefined);
    vi.doMock("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
    const { default: buildWindowHandler } = await import("../src/js/window");
    const bindings = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
      const capture = chordPattern(pattern).exec(input);
      return capture && binding["@input:window"]
        ? [{ capture, args: binding["@input:window"] }]
        : [];
    });
    expect(bindings.length).toBeGreaterThan(0);
    const {
      capture,
      args: [action, argument],
    } = bindings[0];
    const expression = argument.replace(/\$(\d+)/g, (_, index) => capture[Number(index)]);
    await buildWindowHandler().call(
      { focusedAppId: "dev.keychord.fixture", input },
      action,
      expression,
    );
    expect(native).toHaveBeenCalledExactlyOnceWith(
      "dev.keychord.fixture",
      action,
      JSON.stringify(
        input === "/wsh1" ? { height: divisor(1) } : parseWindowDimensions(action, expression),
      ),
    );
    expect(definition.on.window.file).toBe("window.js");
  },
);

test.each([
  ["1100", { width: divisor(1), height: divisor(1), left: fraction(0), top: fraction(0) }],
  ["0022", { left: divisor(2), top: divisor(2) }],
  ["0120", { height: divisor(1), left: divisor(2), top: fraction(0) }],
  ["1-1-24", { width: divisor(1), height: fraction(2), left: divisor(-2), top: divisor(4) }],
])("combined bounds %s preserve zero size axes and retain positional zeros", (input, expected) => {
  expect(parseWindowDimensions("FRAME", input)).toEqual(expected);
});

test.each(["110", "11000", ".51100", "11x00", "00xx", "h1100"])(
  "invalid combined bounds %s never execute",
  (input) => {
    expect(() => parseWindowDimensions("FRAME", input)).toThrow(TypeError);
  },
);

test.each([
  ["/wsw2", "SIZE", "2", { width: divisor(2) }],
  ["/wsh1", "SIZE", "1", { height: divisor(1) }],
  ["/wsh200x", "SIZE", "200x", { height: pixels(200) }],
  ["/wpx-2", "POSITION", "-2", { width: divisor(-2) }],
  ["/wpy4", "POSITION", "4", { height: divisor(4) }],
  ["/wpy-200x", "POSITION", "-200x", { height: pixels(-200) }],
])("named axis %s changes only its named field", async (input, action, expression, expected) => {
  const native = vi.fn().mockResolvedValue(undefined);
  vi.doMock("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
  const { default: buildWindowHandler } = await import("../src/js/window");
  await buildWindowHandler().call(
    { input, focusedAppId: "dev.fixture" },
    action as WindowAction,
    expression,
  );
  expect(native).toHaveBeenCalledExactlyOnceWith("dev.fixture", action, JSON.stringify(expected));
});

test("invalid input never calls native code, and failed actions do not block the next chord", async () => {
  const native = vi.fn().mockRejectedValueOnce(new Error("No window")).mockResolvedValue(undefined);
  vi.doMock("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
  const { default: buildWindowHandler } = await import("../src/js/window");
  const handler = buildWindowHandler();
  await expect(handler("SIZE", "200xgarbage")).rejects.toThrow(TypeError);
  expect(native).not.toHaveBeenCalled();
  await expect(handler("SIZE", "22")).rejects.toThrow("No window");
  await handler("POSITION", "r1");
  expect(native).toHaveBeenCalledTimes(2);
});

test("overlapping actions are serialized and keep their own application context", async () => {
  let finish!: () => void;
  const native = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  vi.doMock("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
  const { default: buildWindowHandler } = await import("../src/js/window");
  const handler = buildWindowHandler();
  const first = handler.call({ focusedAppId: "first" }, "SIZE", "22");
  const second = handler.call({ focusedAppId: "second" }, "POSITION", "r1");
  await vi.waitFor(() => expect(native).toHaveBeenCalledTimes(1));
  finish();
  await Promise.all([first, second]);
  expect(native.mock.calls.map(([app]) => app)).toEqual(["first", "second"]);
});

test("native snapping replaces the platform tiling shortcuts", () => {
  for (const command of [
    "/wl",
    "/wr",
    "/wt",
    "/wb",
    "/wtl",
    "/wtr",
    "/wbl",
    "/wbr",
    "/wlr",
    "/wrl",
    "/wtb",
    "/wbt",
    "/wc",
    "/wf",
  ]) {
    expect(definition.chords[command].shortcut).toBeUndefined();
    expect(definition.chords[command]["@input:window"]?.[0]).toBe("PRESET");
  }
});
