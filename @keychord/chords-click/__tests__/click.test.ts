import { readFileSync } from "node:fs";
import { click, getAppWindows } from "chord";
import { chordPattern } from "@keychord/chordtest/patterns";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import buildClickHandler from "../src/js/click";
import type { ClickKind } from "../src/js/utils/click-sequence";
const bounds = { x: -100, y: 200, width: 300, height: 600 };
const window = { windowId: 123, processId: 456, bounds, title: "First window" };
const clickMock = vi.mocked(click);
const windowsMock = vi.mocked(getAppWindows);
const source = readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8");
const bindings = Array.from(
  source.matchAll(/^'([^']+)' = .*'@input:click' = \['(\$\d+)', '(left|right|middle|double)'\]/gm),
  ([, pattern, argument, defaultClick]) => ({
    pattern: chordPattern(pattern),
    argument,
    defaultClick: defaultClick as Exclude<ClickKind, "long">,
  }),
);
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
  windowsMock.mockReturnValue([window, { ...window, windowId: 789, title: "Other window" }]);
});
afterEach(() => {
  vi.useRealTimers();
});

test("four initial click types capture coordinates and leave modifier prefixes unmatched", () => {
  expect(source).toMatch(/\[on\.click\]\s+file = 'click\.js'/);
  expect(bindings).toHaveLength(4);
  for (const input of [
    ".",
    "..",
    ".,",
    ".;",
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
  const sequence = "20b5/-5/37/0r20b/65";
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
      });
  },
);
test.each([
  ["..-9,9228", ["double", "right", "double"]],
  [".,-9;9228", ["right", "middle", "right"]],
  [".;-9.9228", ["middle", "left", "middle"]],
  [".-9..9228", ["left", "double", "left"]],
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
      ...(kind === "double" ? { clickCount: 2 } : {}),
      ...(kind === "right" || kind === "middle" ? { button: kind } : {}),
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
test.each(["13,", "13;", "13.", "13..", "1,3", "13,5"])(
  "an incomplete button override rejects before any input: %s",
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
  await expect(buildClickHandler("dev.fixture")("20b5/0r601b")).rejects.toThrow("outside");
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
  });
});

test("clicks wait 500 ms and retain the target window throughout a sequence", async () => {
  vi.useFakeTimers();
  const action = buildClickHandler("dev.fixture")("--/0r0b");
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
