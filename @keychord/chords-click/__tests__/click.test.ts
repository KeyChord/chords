import { readFileSync } from "node:fs";
import { click, getAppWindows, getScreenBounds, mouse } from "chord";
import { chordPattern } from "@keychord/chordtest/patterns";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import buildClickHandler from "../src/js/click";
import { parseMouseCommand, resolveClickSequence } from "../src/js/utils/click-sequence";
const bounds = { x: -100, y: 200, width: 300, height: 600 };
const window = { windowId: 123, processId: 456, bounds, title: "First window" };
const clickMock = vi.mocked(click);
const windowsMock = vi.mocked(getAppWindows);
const source = readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8");
const bindings = Array.from(
  source.matchAll(/^'([^']+)' = .*'@input:click' = \['(\$\d+)', '(COMMAND)'\]/gm),
  ([, pattern, argument, defaultClick]) => ({
    pattern: chordPattern(pattern),
    argument,
    defaultClick: defaultClick as "COMMAND",
  }),
);
const namedChords = [
  { prefix: ".", name: "Click", action: "click" },
  { prefix: "..", name: "Double Click", action: "click", clickCount: 2 },
  { prefix: ".,", name: "Right Click", action: "click", button: "right" },
  { prefix: ".;", name: "Middle Click", action: "click", button: "middle" },
  { prefix: ".-", name: "Drag", action: "down", button: "left" },
  { prefix: ".,-", name: "Right Drag", action: "down", button: "right" },
  { prefix: ".;-", name: "Middle Drag", action: "down", button: "middle" },
  { prefix: ".=", name: "Move Mouse", action: "move" },
  { prefix: "./", name: "Global Mouse", action: "click", global: true },
] as const;
function capturedClick(input: string) {
  const matches = bindings.flatMap(({ pattern, argument, defaultClick }) => {
    const capture = pattern.exec(input);
    return capture ? [{ sequence: capture[Number(argument.slice(1))], defaultClick }] : [];
  });
  expect(matches).toHaveLength(1);
  return matches[0];
}
beforeEach(() => {
  clickMock.mockResolvedValue(undefined);
  vi.mocked(mouse).mockResolvedValue(undefined);
  vi.mocked(getScreenBounds).mockReturnValue({ x: -1200, y: -300, width: 1200, height: 800 });
  windowsMock.mockReturnValue([window, { ...window, windowId: 789, title: "Other window" }]);
});
afterEach(() => {
  vi.useRealTimers();
});

test("every named chord in macos.toml has a behavior test", () => {
  const definitions = Array.from(
    source.matchAll(/^'\?([^']+)' = \{ name = '([^']+)' \}/gm),
    ([, prefix, name]) => ({ prefix, name }),
  );
  expect(definitions).toEqual(namedChords.map(({ prefix, name }) => ({ prefix, name })));
  expect(source).toContain("name = 'Mouse', '@input:click' = ['$1', 'COMMAND']");
});

test.each(namedChords)(
  "$name reaches its native action through the TOML binding",
  async (chord) => {
    const captured = capturedClick(chord.prefix + "13");
    await buildClickHandler().call(
      { focusedAppId: "dev.fixture" },
      captured.sequence,
      captured.defaultClick,
    );
    const options = {
      ...("global" in chord
        ? { x: -1080, y: -60 }
        : { windowId: 123, x: 30, y: 180, expectedBounds: bounds }),
      ...("button" in chord ? { button: chord.button } : {}),
      ...("clickCount" in chord ? { clickCount: chord.clickCount } : {}),
    };
    if ("global" in chord) {
      expect(getAppWindows).not.toHaveBeenCalled();
      expect(getScreenBounds).toHaveBeenCalledOnce();
      expect(click).not.toHaveBeenCalled();
      expect(mouse).toHaveBeenCalledExactlyOnceWith({ ...options, action: chord.action });
    } else if (chord.action === "click") {
      expect(getScreenBounds).not.toHaveBeenCalled();
      expect(click).toHaveBeenCalledExactlyOnceWith({ ...options, moveCursor: true });
      expect(mouse).not.toHaveBeenCalled();
    } else {
      expect(click).not.toHaveBeenCalled();
      expect(mouse).toHaveBeenCalledTimes(2);
      expect(mouse).toHaveBeenNthCalledWith(1, { ...options, action: chord.action });
      expect(mouse).toHaveBeenLastCalledWith({ action: "up" });
    }
  },
);

test("one mouse binding captures commands and leaves application prefixes unmatched", () => {
  expect(source).toMatch(/\[on\.click\]\s+file = 'click\.js'/);
  expect(bindings).toHaveLength(1);
  for (const input of [
    ".",
    ".m",
    ".c",
    ".a",
    ".f",
    ".s",
    ".a-c",
    ".af-c",
    ".b20l5",
    "x13",
    "t13",
  ]) {
    expect(
      bindings.some(({ pattern }) => pattern.test(input)),
      input,
    ).toBe(false);
  }
});
test("the documented sequence forwards all five clicks in order", async () => {
  vi.useFakeTimers();
  const sequence = "20b5-53/07/00r20b65";
  const captured = capturedClick("." + sequence);
  expect(captured.sequence).toBe(sequence);
  const action = buildClickHandler().call(
    { focusedAppId: "dev.fixture" },
    captured.sequence,
    captured.defaultClick,
  );
  await vi.runAllTimersAsync();
  await action;
  expect(getAppWindows).toHaveBeenCalledExactlyOnceWith("dev.fixture");
  const points = [
    { x: 150, y: 580 },
    { x: 0, y: 300 },
    { x: 90, y: 420 },
    { x: 299, y: 580 },
    { x: 180, y: 300 },
  ];
  expect(click).toHaveBeenCalledTimes(points.length);
  for (const [index, point] of points.entries())
    expect(click).toHaveBeenNthCalledWith(index + 1, {
      windowId: 123,
      ...point,
      expectedBounds: bounds,
      moveCursor: true,
    });
});
test.each([".1313", ".20l5", ".30r180b", ".20t5", ".0-"])(
  "compact, edge and pixel coordinates reach the handler: %s",
  async (input) => {
    vi.useFakeTimers();
    const captured = capturedClick(input);
    const action = buildClickHandler("dev.fixture")(captured.sequence, captured.defaultClick);
    await vi.runAllTimersAsync();
    await action;
    const points =
      input === ".1313"
        ? [
            { x: 30, y: 180 },
            { x: 30, y: 180 },
          ]
        : input === ".20l5"
          ? [{ x: 20, y: 300 }]
          : input === ".30r180b"
            ? [{ x: 270, y: 420 }]
            : input === ".0-"
              ? [{ x: 299, y: 0 }]
              : [{ x: 150, y: 20 }];
    expect(click).toHaveBeenCalledTimes(points.length);
    for (const [index, point] of points.entries())
      expect(click).toHaveBeenNthCalledWith(index + 1, {
        windowId: 123,
        ...point,
        expectedBounds: bounds,
        moveCursor: true,
      });
  },
);
test.each([
  ["..-9,9228", ["DOUBLE", "RIGHT", "DOUBLE"]],
  [".,0l9;9228", ["RIGHT", "MIDDLE", "RIGHT"]],
  [".;0l9.9228", ["MIDDLE", "LEFT", "MIDDLE"]],
  [".0l9..9228", ["LEFT", "DOUBLE", "LEFT"]],
] as const)("one-click overrides reset to the initial click type: %s", async (input, kinds) => {
  vi.useFakeTimers();
  const captured = capturedClick(input);
  const action = buildClickHandler("dev.fixture")(captured.sequence, captured.defaultClick);
  await vi.runAllTimersAsync();
  await action;
  const points = [
    { x: 0, y: 540 },
    { x: 270, y: 120 },
    { x: 60, y: 480 },
  ];
  expect(click).toHaveBeenCalledTimes(3);
  for (const [index, point] of points.entries()) {
    const kind = kinds[index];
    expect(click).toHaveBeenNthCalledWith(index + 1, {
      windowId: 123,
      ...point,
      expectedBounds: bounds,
      moveCursor: true,
      ...(kind === "DOUBLE" ? { clickCount: 2 } : {}),
      ...(kind === "RIGHT" || kind === "MIDDLE" ? { button: kind.toLowerCase() } : {}),
    });
  }
});
test.each([
  [".", "LEFT"],
  ["..", "DOUBLE"],
  [".,", "RIGHT"],
  [".;", "MIDDLE"],
] as const)("mixed-fraction pairs retain the initial click type: %s", async (prefix, kind) => {
  vi.useFakeTimers();
  const captured = capturedClick(prefix + "91/21/23/4");
  expect(captured.sequence).toBe(prefix.slice(1) + "91/21/23/4");
  const action = buildClickHandler("dev.fixture")(captured.sequence, captured.defaultClick);
  await vi.runAllTimersAsync();
  await action;
  expect(click).toHaveBeenCalledTimes(2);
  for (const [index, point] of [
    { x: 270, y: 72 },
    { x: 36, y: 204 },
  ].entries()) {
    expect(click).toHaveBeenNthCalledWith(index + 1, {
      windowId: 123,
      ...point,
      expectedBounds: bounds,
      moveCursor: true,
      ...(kind === "DOUBLE" ? { clickCount: 2 } : {}),
      ...(kind === "RIGHT" || kind === "MIDDLE" ? { button: kind.toLowerCase() } : {}),
    });
  }
});
test("an explicit app overrides the focused-app context and works for direct calls", async () => {
  const handler = buildClickHandler("dev.target");
  await handler.call({ focusedAppId: "dev.other" }, "30l20t");
  await handler("--");
  expect(getAppWindows).toHaveBeenNthCalledWith(1, "dev.target");
  expect(getAppWindows).toHaveBeenNthCalledWith(2, "dev.target");
});
test.each(["13,", "13;", "13.", "13..", "1,3", "13,5", "91/", "13//28"])(
  "a malformed sequence rejects before any input: %s",
  async (sequence) => {
    await expect(buildClickHandler("dev.fixture")(sequence)).rejects.toThrow(TypeError);
    expect(getAppWindows).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  },
);

test("missing app context rejects before querying windows or sending input", async () => {
  await expect(buildClickHandler()("--")).rejects.toThrow("focused application");
  expect(getAppWindows).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
});

test("malformed trailing input rejects before querying windows or sending input", async () => {
  await expect(buildClickHandler("dev.fixture")("20b5.1")).rejects.toThrow(TypeError);
  expect(getAppWindows).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
});

test("an out-of-bounds final click prevents the whole sequence", async () => {
  await expect(buildClickHandler("dev.fixture")("20b5/00r601b")).rejects.toThrow("outside");
  expect(click).not.toHaveBeenCalled();
});

test.each([
  { ...bounds, width: 0 },
  { ...bounds, height: -1 },
  { ...bounds, x: NaN },
  { ...bounds, y: Infinity },
])("invalid window bounds reject before sending input: %j", async (invalidBounds) => {
  windowsMock.mockReturnValue([{ ...window, bounds: invalidBounds }]);
  await expect(buildClickHandler("dev.fixture")("--")).rejects.toThrow("invalid bounds");
  expect(click).not.toHaveBeenCalled();
});

test("an app with no visible window rejects and the next invocation can recover", async () => {
  const handler = buildClickHandler("dev.fixture");
  windowsMock.mockReturnValueOnce([]);
  await expect(handler("--")).rejects.toThrow("No on-screen window found for dev.fixture");
  expect(click).not.toHaveBeenCalled();
  await expect(handler("--")).resolves.toBeUndefined();
});

test("overlapping sequences serialize and retain each invocation's captured app", async () => {
  let finishFirst!: () => void;
  clickMock.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishFirst = resolve;
      }),
  );
  const handler = buildClickHandler();
  const context = { focusedAppId: "dev.first" };
  const first = handler.call(context, "--");
  context.focusedAppId = "dev.second";
  const second = handler.call(context, "30r20b");
  context.focusedAppId = "dev.unrelated";
  await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(getAppWindows).toHaveBeenCalledExactlyOnceWith("dev.first");
  finishFirst();
  await Promise.all([first, second]);
  expect(getAppWindows).toHaveBeenNthCalledWith(2, "dev.second");
  expect(click).toHaveBeenNthCalledWith(2, {
    windowId: 123,
    x: 270,
    y: 580,
    expectedBounds: bounds,
    moveCursor: true,
  });
});

test("the next sequence reads the window's current size and position", async () => {
  const handler = buildClickHandler("dev.fixture");
  await handler("85");
  const resized = { x: -500, y: -300, width: 200, height: 400 };
  windowsMock.mockReturnValue([{ ...window, bounds: resized }]);
  await handler("85");
  expect(click).toHaveBeenNthCalledWith(2, {
    windowId: 123,
    x: 160,
    y: 200,
    expectedBounds: resized,
    moveCursor: true,
  });
});

test("clicks wait 500 ms and retain the target window throughout a sequence", async () => {
  vi.useFakeTimers();
  const action = buildClickHandler("dev.fixture")("--0r0b");
  await vi.advanceTimersByTimeAsync(0);
  expect(click).toHaveBeenCalledOnce();
  windowsMock.mockReturnValue([{ ...window, windowId: 789 }]);
  await vi.advanceTimersByTimeAsync(499);
  expect(click).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  await action;
  expect(getAppWindows).toHaveBeenCalledOnce();
  expect(click).toHaveBeenNthCalledWith(2, {
    windowId: 123,
    x: 299,
    y: 599,
    expectedBounds: bounds,
    moveCursor: true,
  });
});

test("a moved or disappeared window stops the sequence and later invocations recover", async () => {
  const handler = buildClickHandler("dev.fixture");
  clickMock.mockRejectedValueOnce(new Error("target window moved or resized"));
  await expect(handler("00.30r20b")).rejects.toThrow("moved or resized");
  expect(click).toHaveBeenCalledOnce();
  await expect(handler("--")).resolves.toBeUndefined();
});

test("window lookup errors propagate without breaking later invocations", async () => {
  const handler = buildClickHandler("dev.fixture");
  windowsMock.mockImplementationOnce(() => {
    throw new Error("could not enumerate windows");
  });
  await expect(handler("--")).rejects.toThrow("could not enumerate windows");
  expect(click).not.toHaveBeenCalled();
  await expect(handler("--")).resolves.toBeUndefined();
});

test.each([
  [".-1328", "left"],
  [".,-1328", "right"],
  [".;-1328", "middle"],
] as const)("%s drags with one press and releases at the final point", async (input, button) => {
  vi.useFakeTimers();
  const captured = capturedClick(input);
  const action = buildClickHandler("dev.fixture")(captured.sequence, captured.defaultClick);
  await vi.runAllTimersAsync();
  await action;
  expect(click).not.toHaveBeenCalled();
  expect(mouse).toHaveBeenCalledTimes(3);
  expect(mouse).toHaveBeenNthCalledWith(1, {
    action: "down",
    button,
    windowId: 123,
    x: 30,
    y: 180,
    expectedBounds: bounds,
  });
  expect(mouse).toHaveBeenNthCalledWith(2, {
    action: "move",
    windowId: 123,
    x: 60,
    y: 480,
    expectedBounds: bounds,
  });
  expect(mouse).toHaveBeenLastCalledWith({ action: "up" });
});

test("trailing dash latches the final click and a later move sequence releases it", async () => {
  const handler = buildClickHandler("dev.fixture");
  await handler("13-", "COMMAND");
  expect(mouse).toHaveBeenCalledExactlyOnceWith({
    action: "down",
    button: "left",
    windowId: 123,
    x: 30,
    y: 180,
    expectedBounds: bounds,
  });
  await handler("=28", "COMMAND");
  expect(mouse).toHaveBeenNthCalledWith(2, {
    action: "move",
    windowId: 123,
    x: 60,
    y: 480,
    expectedBounds: bounds,
  });
  expect(mouse).toHaveBeenLastCalledWith({ action: "up" });
});

test("a trailing dash on a multi-point drag omits the final release", async () => {
  vi.useFakeTimers();
  const action = buildClickHandler("dev.fixture")("-1328-", "COMMAND");
  await vi.runAllTimersAsync();
  await action;
  expect(mouse).toHaveBeenCalledTimes(2);
  expect(vi.mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual(["down", "move"]);
});

test.each(["LEFT", "RIGHT", "MIDDLE"] as const)(
  "a latched %s drag is released when the next command cannot be parsed",
  async (button) => {
    const handler = buildClickHandler("dev.fixture");
    await handler("13-", button);
    await expect(handler("13junk", "COMMAND")).rejects.toThrow(TypeError);
    expect(mouse).toHaveBeenLastCalledWith({ action: "up" });
    await expect(handler("13", "COMMAND")).resolves.toBeUndefined();
  },
);

test.each(["missing window", "window lookup", "out of bounds", "screen lookup"])(
  "a latched drag is released when the next command fails before native input: %s",
  async (failure) => {
    const handler = buildClickHandler("dev.fixture");
    await handler("-13-", "COMMAND");
    let sequence = "=28";
    if (failure === "missing window") windowsMock.mockReturnValueOnce([]);
    else if (failure === "window lookup") {
      windowsMock.mockImplementationOnce(() => {
        throw new Error("window lookup failed");
      });
    } else if (failure === "out of bounds") sequence = "=301l5";
    else {
      sequence = "/=28";
      vi.mocked(getScreenBounds).mockImplementationOnce(() => {
        throw new Error("screen lookup failed");
      });
    }
    await expect(handler(sequence, "COMMAND")).rejects.toThrow();
    expect(mouse).toHaveBeenCalledTimes(2);
    expect(mouse).toHaveBeenLastCalledWith({ action: "up" });
    expect(click).not.toHaveBeenCalled();
    await expect(handler("13", "COMMAND")).resolves.toBeUndefined();
  },
);

test("a malformed overlapping command waits for the earlier hold before releasing it", async () => {
  vi.useFakeTimers();
  const handler = buildClickHandler("dev.fixture");
  const drag = handler("-1328-", "COMMAND");
  const malformed = expect(handler("13junk", "COMMAND")).rejects.toThrow(TypeError);
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual(["down"]);
  await vi.runAllTimersAsync();
  await Promise.all([drag, malformed]);
  expect(vi.mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual([
    "down",
    "move",
    "up",
  ]);
});

test.each(["=13", "/=13", "=/13"])(
  "%s moves without sending any button presses",
  async (sequence) => {
    await buildClickHandler("dev.fixture")(sequence, "COMMAND");
    expect(click).not.toHaveBeenCalled();
    expect(vi.mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual(["move", "up"]);
  },
);

test("global clicks use the captured screen bounds and need no application context", async () => {
  vi.useFakeTimers();
  const action = buildClickHandler()("/551/23/4", "COMMAND");
  await vi.runAllTimersAsync();
  await action;
  expect(getAppWindows).not.toHaveBeenCalled();
  expect(getScreenBounds).toHaveBeenCalledOnce();
  expect(mouse).toHaveBeenNthCalledWith(1, { action: "click", x: -600, y: 100 });
  expect(mouse).toHaveBeenNthCalledWith(2, { action: "click", x: -1056, y: -28 });
});

test.each(["/-1328", "-/1328", "/;-1328"])(
  "global drag modifiers combine: %s",
  async (sequence) => {
    vi.useFakeTimers();
    const action = buildClickHandler()(sequence, "COMMAND");
    await vi.runAllTimersAsync();
    await action;
    expect(getAppWindows).not.toHaveBeenCalled();
    expect(vi.mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual([
      "down",
      "move",
      "up",
    ]);
    expect(mouse).toHaveBeenNthCalledWith(1, {
      action: "down",
      button: sequence.includes(";") ? "middle" : "left",
      x: -1080,
      y: -60,
    });
  },
);

test("a failed move releases the held mouse and the next sequence can recover", async () => {
  vi.useFakeTimers();
  vi.mocked(mouse)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("window moved"));
  const handler = buildClickHandler("dev.fixture");
  const action = handler("-1328-", "COMMAND");
  const rejected = expect(action).rejects.toThrow("window moved");
  await vi.runAllTimersAsync();
  await rejected;
  expect(mouse).toHaveBeenLastCalledWith({ action: "up" });
  await expect(handler("13", "COMMAND")).resolves.toBeUndefined();
});

test("drag markers persist across bare pairs and explicit clicks end the drag", async () => {
  vi.useFakeTimers();
  const action = buildClickHandler("dev.fixture")("13.-2855.67", "COMMAND");
  await vi.runAllTimersAsync();
  await action;
  expect(vi.mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual([
    "down",
    "move",
    "up",
    "up",
  ]);
  expect(click).toHaveBeenCalledTimes(2);
});

test("dash coordinates and the trailing hold are unambiguous after complete pairs", () => {
  const points = (sequence: string) =>
    resolveClickSequence(parseMouseCommand(sequence).positions, bounds);
  expect(points("-0l0t55-")).toEqual([
    { x: -100, y: 200, click: "DRAG" },
    { x: 50, y: 500, click: "DRAG", hold: true },
  ]);
  expect(points("=--")).toEqual([{ x: -100, y: 200, click: "MOVE" }]);
  expect(points("-/--")).toEqual([{ x: -100, y: 200, click: "DRAG" }]);
  expect(points("0-")).toEqual([{ x: 199, y: 200, click: "LEFT" }]);
});

test.each(["-13junk", "=131", "/13junk", "/=/13", "-=13", "=;13", ".13-"])(
  "malformed mouse commands reject before sending input: %s",
  async (sequence) => {
    await expect(buildClickHandler("dev.fixture")(sequence, "COMMAND")).rejects.toThrow(TypeError);
    expect(click).not.toHaveBeenCalled();
    expect(mouse).not.toHaveBeenCalled();
    expect(getScreenBounds).not.toHaveBeenCalled();
  },
);
