import { expect, mock, test } from "bun:test";
import { chordPattern } from "@keychord/chordtest/patterns";
import { waitFor } from "@keychord/chordtest/test";
import {
  parseWindowDimensions,
  type WindowAction,
  type WindowDimension,
} from "../src/js/utils/window-dimensions";
import buildWindowHandler, { type WindowHandlerAction } from "../src/js/window";

const divisor = (value: number): WindowDimension => ({ value, unit: "divisor" });
const fraction = (value: number): WindowDimension => ({ value, unit: "fraction" });
const pixels = (value: number): WindowDimension => ({ value, unit: "pixels" });

test.each([
  ["/ws1", "1"],
  ["/ws12", "12"],
  ["/ws]", "NEXT"],
  ["/ws[", "PREVIOUS"],
])("%s moves the captured application's window to the requested Space", async (input, target) => {
  const moveWindowToSpace = mock().mockResolvedValue(undefined);
  const runWindowAction = mock();
  mock.module("../src/js/window.node", () => ({ default: { moveWindowToSpace, runWindowAction } }));
  const matches = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
    const capture = chordPattern(pattern).exec(input);
    const args = binding["@input:window"];
    return capture && args
      ? [args.map((argument) => argument.replace(/\$(\d+)/g, (_, index) => capture[Number(index)]))]
      : [];
  });
  expect(matches).toEqual([["SPACE", target]]);
  await buildWindowHandler().call({ focusedAppId: "dev.fixture", input }, "SPACE", target);
  expect(moveWindowToSpace).toHaveBeenCalledTimes(1);
  expect(moveWindowToSpace).toHaveBeenCalledWith("dev.fixture", null, target);
  expect(runWindowAction).not.toHaveBeenCalled();
});

test("Space targets are validated and failed moves do not block subsequent geometry", async () => {
  const moveWindowToSpace = mock().mockRejectedValueOnce(new Error("Space does not exist"));
  const runWindowAction = mock().mockResolvedValue(undefined);
  mock.module("../src/js/window.node", () => ({ default: { moveWindowToSpace, runWindowAction } }));
  const handler = buildWindowHandler();
  for (const target of ["", "0", "01", "-1", "1.5", "9007199254740992", "SIDEWAYS"])
    await expect(handler("SPACE", target)).rejects.toThrow(TypeError);
  expect(moveWindowToSpace).not.toHaveBeenCalled();
  await expect(handler("SPACE", "99")).rejects.toThrow("Space does not exist");
  await handler("DIMENSIONS", "22");
  expect(runWindowAction).toHaveBeenCalledTimes(1);
});

test("Space moves wait for preceding window actions and retain their application context", async () => {
  let finish!: () => void;
  const runWindowAction = mock().mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const moveWindowToSpace = mock().mockResolvedValue(undefined);
  mock.module("../src/js/window.node", () => ({ default: { moveWindowToSpace, runWindowAction } }));
  const handler = buildWindowHandler();
  const geometry = handler.call({ focusedAppId: "first" }, "DIMENSIONS", "22");
  const move = handler.call({ focusedAppId: "second" }, "SPACE", "NEXT");
  await waitFor(() => expect(runWindowAction).toHaveBeenCalledTimes(1));
  expect(moveWindowToSpace).not.toHaveBeenCalled();
  finish();
  await Promise.all([geometry, move]);
  expect(moveWindowToSpace).toHaveBeenCalledWith("second", null, "NEXT");
});

test("repetitions act on the window Chord selected for the run, not the focused one", async () => {
  // Chord calls the built handler once per repetition with the same selected window,
  // which focus leaves once `/ws]` moves it off the visible Space.
  const moveWindowToSpace = mock().mockResolvedValue(undefined);
  const runWindowAction = mock().mockResolvedValue(undefined);
  const cycleWindows = mock().mockResolvedValue(undefined);
  mock.module("../src/js/window.node", () => ({
    default: { moveWindowToSpace, runWindowAction, cycleWindows },
  }));
  const handler = buildWindowHandler();
  const run = { focusedAppId: "dev.fixture", focusedWindowId: 42, input: "/ws]" };
  for (let repetition = 0; repetition < 3; repetition++) await handler.call(run, "SPACE", "NEXT");
  expect(moveWindowToSpace.mock.calls).toEqual(Array(3).fill(["dev.fixture", 42, "NEXT"]));
  for (let repetition = 0; repetition < 3; repetition++)
    await handler.call({ ...run, input: "/wd=" }, "DIMENSIONS_INCREASE", "");
  expect(runWindowAction.mock.calls.map(([app, window]) => [app, window])).toEqual(
    Array(3).fill(["dev.fixture", 42]),
  );
  // Cycling advances from the window the previous repetition focused.
  await handler.call({ ...run, input: "/w]" }, "CYCLE", "NEXT");
  expect(cycleWindows).toHaveBeenCalledWith("dev.fixture", "NEXT");
  for (const focusedWindowId of [-1, 1.5, Number.NaN])
    await expect(handler.call({ ...run, focusedWindowId }, "SPACE", "NEXT")).rejects.toThrow(
      TypeError,
    );
  expect(moveWindowToSpace).toHaveBeenCalledTimes(3);
});

test.each([
  ["DIMENSIONS_INCREASE", "", 1.1],
  ["DIMENSIONS_INCREASE", "1", 1.1],
  ["DIMENSIONS_INCREASE", "5", 1.5],
  ["DIMENSIONS_INCREASE", "9", 1.9],
  ["DIMENSIONS_INCREASE", "0", 2],
  ["DIMENSIONS_DECREASE", "", 0.9],
  ["DIMENSIONS_DECREASE", "1", 0.9],
  ["DIMENSIONS_DECREASE", "5", 0.5],
  ["DIMENSIONS_DECREASE", "9", 0.1],
] as const)("%s %s scales both current dimensions by %s", (action, input, scale) => {
  expect(parseWindowDimensions(action, input)).toEqual({
    width: fraction(scale),
    height: fraction(scale),
  });
  expect(parseWindowDimensions(action, `h${input}`)).toEqual({ height: fraction(scale) });
});

test.each(["10", "22", "-1", "=1", ".5", "50%", "200x", "h11", "Infinity", "junk"])(
  "invalid relative size %s is rejected",
  (input) => {
    for (const action of ["DIMENSIONS_INCREASE", "DIMENSIONS_DECREASE"] as const)
      expect(() => parseWindowDimensions(action, input)).toThrow(TypeError);
  },
);

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
  expect(parseWindowDimensions("DIMENSIONS", input)).toEqual(expected);
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
  for (const action of ["DIMENSIONS", "POSITION"] as const) {
    expect(() => parseWindowDimensions(action, input)).toThrow(TypeError);
  }
});
test.each(["0", ".0", "20", ".5", "-.5", "0x", "200x0", "h-200x", "r1"])(
  "invalid size %s is rejected",
  (input) => expect(() => parseWindowDimensions("DIMENSIONS", input)).toThrow(TypeError),
);

const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as {
  on: Record<string, { file: string }>;
  chords: Record<string, { "@input:window"?: [WindowHandlerAction, string]; shortcut?: string }>;
};

test.each(["/wd22", "/wd-1", "/wdh1", "/wd200x200", "/wp22", "/wpr1", "/wp-1", "/wph-2"])(
  "%s dispatches the TOML capture to the native handler with the captured app",
  async (input) => {
    const native = mock().mockResolvedValue(undefined);
    mock.module("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
    const bindings = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
      const capture = chordPattern(pattern).exec(input);
      return capture && binding["@input:window"]
        ? [{ capture, args: binding["@input:window"] }]
        : [];
    });
    expect(bindings).toHaveLength(1);
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
    expect(native).toHaveBeenCalledTimes(1);
    expect(native).toHaveBeenCalledWith(
      "dev.keychord.fixture",
      null,
      action,
      JSON.stringify(
        input === "/wdh1"
          ? { height: divisor(1) }
          : parseWindowDimensions(action as WindowAction, expression),
      ),
    );
    expect(definition.on.window.file).toBe("window.js");
  },
);

test.each(
  ["/wd", "/wdw", "/wdh"].flatMap((prefix) =>
    (
      [
        ["=", "DIMENSIONS_INCREASE", "", 1.1],
        ["=1", "DIMENSIONS_INCREASE", "1", 1.1],
        ["=5", "DIMENSIONS_INCREASE", "5", 1.5],
        ["=0", "DIMENSIONS_INCREASE", "0", 2],
        ["-", "DIMENSIONS_DECREASE", "", 0.9],
        ["-1", "DIMENSIONS_DECREASE", "1", 0.9],
        ["-5", "DIMENSIONS_DECREASE", "5", 0.5],
        ["-9", "DIMENSIONS_DECREASE", "9", 0.1],
      ] as const
    ).map(([suffix, action, expression, scale]) => ({
      input: `${prefix}${suffix}`,
      action,
      expression,
      expected: {
        ...(prefix !== "/wdh" ? { width: fraction(scale) } : {}),
        ...(prefix !== "/wdw" ? { height: fraction(scale) } : {}),
      },
    })),
  ),
)(
  "$input adjusts only the selected dimensions with an unambiguous binding",
  async ({ input, action, expression, expected }) => {
    const native = mock().mockResolvedValue(undefined);
    mock.module("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
    const matches = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
      const capture = chordPattern(pattern).exec(input);
      return capture && binding["@input:window"]
        ? [{ capture, args: binding["@input:window"] }]
        : [];
    });
    expect(matches).toHaveLength(1);
    const { capture, args } = matches[0];
    expect(args[0]).toBe(action);
    const argument = args[1].replace(/\$(\d+)/g, (_, index) => capture[Number(index)]);
    expect(argument).toBe(expression);
    await buildWindowHandler().call({ focusedAppId: "dev.fixture", input }, args[0], argument);
    expect(native).toHaveBeenCalledTimes(1);
    expect(native).toHaveBeenCalledWith("dev.fixture", null, action, JSON.stringify(expected));
  },
);

test.each(["/wd-0", "/wdw-0", "/wdh-0"])(
  "%s rejects a zero-sized result before calling native code",
  async (input) => {
    const native = mock();
    mock.module("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
    const handler = buildWindowHandler();
    await expect(handler.call({ input }, "DIMENSIONS_DECREASE", "0")).rejects.toThrow(
      "100% decrease",
    );
    expect(native).not.toHaveBeenCalled();
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

test.each([
  ["/w[", "PREVIOUS"],
  ["/w]", "NEXT"],
])("%s cycles windows natively in the captured application", async (input, direction) => {
  const cycleWindows = mock().mockResolvedValue(undefined);
  const runWindowAction = mock();
  mock.module("../src/js/window.node", () => ({ default: { cycleWindows, runWindowAction } }));
  const binding = definition.chords[input];
  expect(binding.shortcut).toBeUndefined();
  expect(binding["@input:window"]).toEqual(["CYCLE", direction]);
  await buildWindowHandler().call(
    { focusedAppId: "dev.fixture", input },
    ...binding["@input:window"]!,
  );
  expect(cycleWindows).toHaveBeenCalledWith("dev.fixture", direction);
  expect(runWindowAction).not.toHaveBeenCalled();
});

test("window cycling validates directions and recovers from native failures", async () => {
  const cycleWindows = mock()
    .mockRejectedValueOnce(new Error("Focus failed"))
    .mockResolvedValue(undefined);
  const runWindowAction = mock().mockResolvedValue(undefined);
  mock.module("../src/js/window.node", () => ({ default: { cycleWindows, runWindowAction } }));
  const handler = buildWindowHandler();
  await expect(handler("CYCLE", "SIDEWAYS")).rejects.toThrow(TypeError);
  expect(cycleWindows).not.toHaveBeenCalled();
  await expect(handler("CYCLE", "NEXT")).rejects.toThrow("Focus failed");
  await handler("DIMENSIONS", "22");
  await handler("CYCLE", "PREVIOUS");
  expect(cycleWindows).toHaveBeenCalledTimes(2);
  expect(cycleWindows).toHaveBeenLastCalledWith(undefined, "PREVIOUS");
  expect(runWindowAction).toHaveBeenCalledTimes(1);
});

test("window focus and geometry actions share the same queue", async () => {
  let finish!: () => void;
  const cycleWindows = mock().mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const runWindowAction = mock().mockResolvedValue(undefined);
  mock.module("../src/js/window.node", () => ({ default: { cycleWindows, runWindowAction } }));
  const handler = buildWindowHandler();
  const focus = handler.call({ focusedAppId: "dev.fixture" }, "CYCLE", "NEXT");
  const resize = handler.call({ focusedAppId: "dev.fixture" }, "DIMENSIONS", "22");
  await waitFor(() => expect(cycleWindows).toHaveBeenCalledTimes(1));
  expect(runWindowAction).not.toHaveBeenCalled();
  finish();
  await Promise.all([focus, resize]);
  expect(runWindowAction).toHaveBeenCalledTimes(1);
});

test.each(["110", "11000", ".51100", "11x00", "00xx", "h1100"])(
  "invalid combined bounds %s never execute",
  (input) => {
    expect(() => parseWindowDimensions("FRAME", input)).toThrow(TypeError);
  },
);

test.each([
  ["/wdw2", "DIMENSIONS", "2", { width: divisor(2) }],
  ["/wdh1", "DIMENSIONS", "1", { height: divisor(1) }],
  ["/wdh200x", "DIMENSIONS", "200x", { height: pixels(200) }],
  ["/wpx-2", "POSITION", "-2", { width: divisor(-2) }],
  ["/wpy4", "POSITION", "4", { height: divisor(4) }],
  ["/wpy-200x", "POSITION", "-200x", { height: pixels(-200) }],
])("named axis %s changes only its named field", async (input, action, expression, expected) => {
  const native = mock().mockResolvedValue(undefined);
  mock.module("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
  await buildWindowHandler().call(
    { input, focusedAppId: "dev.fixture" },
    action as WindowAction,
    expression,
  );
  expect(native).toHaveBeenCalledTimes(1);
  expect(native).toHaveBeenCalledWith("dev.fixture", null, action, JSON.stringify(expected));
});

test("invalid input never calls native code, and failed actions do not block the next chord", async () => {
  const native = mock().mockRejectedValueOnce(new Error("No window")).mockResolvedValue(undefined);
  mock.module("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
  const handler = buildWindowHandler();
  await expect(handler("DIMENSIONS", "200xgarbage")).rejects.toThrow(TypeError);
  expect(native).not.toHaveBeenCalled();
  await expect(handler("DIMENSIONS", "22")).rejects.toThrow("No window");
  await handler("POSITION", "r1");
  expect(native).toHaveBeenCalledTimes(2);
});

test("overlapping actions are serialized and keep their own application context", async () => {
  let finish!: () => void;
  const native = mock()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  mock.module("../src/js/window.node", () => ({ default: { runWindowAction: native } }));
  const handler = buildWindowHandler();
  const first = handler.call({ focusedAppId: "first" }, "DIMENSIONS", "22");
  const second = handler.call({ focusedAppId: "second" }, "POSITION", "r1");
  await waitFor(() => expect(native).toHaveBeenCalledTimes(1));
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

test.each([
  ["/wh", "cmd+h"],
  ["/wm", "cmd+m"],
  ["/wq", "cmd+q"],
])("%s keeps its application shortcut", (alias, shortcut) => {
  expect(definition.chords[alias].shortcut).toBe(shortcut);
});
