import { readFileSync } from "node:fs";
import { click, getAppWindows } from "chord";
import { chordPattern } from "@keychord/chordtest/patterns";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import buildClickHandler from "../src/js/click";

const bounds = { x: -100, y: 200, width: 300, height: 600 };
const window = { windowId: 123, processId: 456, bounds, title: "First window" };
const clickMock = vi.mocked(click);
const windowsMock = vi.mocked(getAppWindows);
const source = readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8");
const bindings = Array.from(
  source.matchAll(/^'([^']+)' = .*'@input:click' = \['(\$\d+)'\]/gm),
  ([, pattern, argument]) => ({ pattern: chordPattern(pattern), argument }),
);

function capturedSequence(input: string): string {
  const matches = bindings.flatMap(({ pattern, argument }) => {
    const capture = pattern.exec(input);
    return capture ? [capture[Number(argument.slice(1))]] : [];
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

test("click entry points retain their hints and leave modifier prefixes unmatched", () => {
  expect(source).toMatch(/\[on\.click\]\s+file = 'click\.js'/);
  expect(bindings).toHaveLength(4);
  for (const edge of ["b", "t", "l", "r"]) {
    expect(source).toContain(`'?.${edge}' = { name = "Click from `);
  }
  for (const input of [
    ".",
    ".b",
    ".t",
    ".l",
    ".r",
    ".m",
    ".c",
    ".a",
    ".f",
    ".s",
    ".m20l30",
    "xb20l30",
    "j.b20l30",
    ",b20l30",
  ]) {
    expect(
      bindings.some(({ pattern }) => pattern.test(input)),
      input,
    ).toBe(false);
  }
});

test.each(["b20l.5", "t20l.5", "l.5b20", "r.5t20"])(
  "the . + letter entry point forwards the complete mixed-edge sequence: %s",
  async (first) => {
    vi.useFakeTimers();
    const sequence = `${first}t.5r0b20l.5l30b.25r.4t0`;
    const captured = capturedSequence(`.${sequence}`);
    expect(captured).toBe(sequence);
    const action = buildClickHandler().call({ focusedAppId: "dev.fixture" }, captured);
    await vi.runAllTimersAsync();
    await action;
    expect(getAppWindows).toHaveBeenCalledExactlyOnceWith("dev.fixture");
    const points = [
      { x: 150, y: first === "b20l.5" || first === "l.5b20" ? 580 : 20 },
      { x: 299, y: 300 },
      { x: 150, y: 580 },
      { x: 30, y: 450 },
      { x: 180, y: 0 },
    ];
    expect(click).toHaveBeenCalledTimes(points.length);
    for (const [index, point] of points.entries()) {
      expect(click).toHaveBeenNthCalledWith(index + 1, {
        windowId: 123,
        ...point,
        expectedBounds: bounds,
      });
    }
  },
);

test("the documented global chord forwards the complete sequence", async () => {
  vi.useFakeTimers();
  const sequence = "b20l.5b.5l0b.3l.3b20r0b.5r.4";
  const captured = capturedSequence(`.${sequence}`);
  expect(captured).toBe(sequence);

  const action = buildClickHandler().call({ focusedAppId: "dev.fixture" }, captured);
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
  for (const [index, point] of points.entries()) {
    expect(click).toHaveBeenNthCalledWith(index + 1, {
      windowId: 123,
      ...point,
      expectedBounds: bounds,
    });
  }
});

test("an explicit app overrides the focused-app context and works for direct calls", async () => {
  const handler = buildClickHandler("dev.target");
  await handler.call({ focusedAppId: "dev.other" }, "t20l30");
  await handler("t0l0");
  expect(getAppWindows).toHaveBeenNthCalledWith(1, "dev.target");
  expect(getAppWindows).toHaveBeenNthCalledWith(2, "dev.target");
});

test("missing app context rejects before querying windows or sending input", async () => {
  await expect(buildClickHandler()("t0l0")).rejects.toThrow("focused application");
  expect(getAppWindows).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
});

test("malformed trailing input rejects before querying windows or sending input", async () => {
  await expect(buildClickHandler("dev.fixture")("b20l.5b10")).rejects.toThrow(TypeError);
  expect(getAppWindows).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
});

test("an out-of-bounds final click prevents the whole sequence", async () => {
  await expect(buildClickHandler("dev.fixture")("b20l.5b601r0")).rejects.toThrow("outside");
  expect(click).not.toHaveBeenCalled();
});

test.each([
  { ...bounds, width: 0 },
  { ...bounds, height: -1 },
  { ...bounds, x: NaN },
  { ...bounds, y: Infinity },
])("invalid window bounds reject before sending input: %j", async (invalidBounds) => {
  windowsMock.mockReturnValue([{ ...window, bounds: invalidBounds }]);
  await expect(buildClickHandler("dev.fixture")("t0l0")).rejects.toThrow("invalid bounds");
  expect(click).not.toHaveBeenCalled();
});

test("an app with no visible window rejects and the next invocation can recover", async () => {
  const handler = buildClickHandler("dev.fixture");
  windowsMock.mockReturnValueOnce([]);
  await expect(handler("t0l0")).rejects.toThrow("No on-screen window found for dev.fixture");
  expect(click).not.toHaveBeenCalled();
  await expect(handler("t0l0")).resolves.toBeUndefined();
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
  const first = handler.call(context, "t0l0");
  context.focusedAppId = "dev.second";
  const second = handler.call(context, "b20r30");
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
  await handler("t.5r.25");
  const resized = { x: -500, y: -300, width: 200, height: 400 };
  windowsMock.mockReturnValue([{ ...window, bounds: resized }]);
  await handler("t.5r.25");
  expect(click).toHaveBeenNthCalledWith(2, {
    windowId: 123,
    x: 150,
    y: 200,
    expectedBounds: resized,
  });
});

test("clicks wait 200 ms and retain the target window throughout a sequence", async () => {
  vi.useFakeTimers();
  const action = buildClickHandler("dev.fixture")("t0l0b0r0");
  await vi.advanceTimersByTimeAsync(0);
  expect(click).toHaveBeenCalledOnce();
  windowsMock.mockReturnValue([{ ...window, windowId: 789 }]);
  await vi.advanceTimersByTimeAsync(199);
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
  await expect(handler("t0l0b20r30")).rejects.toThrow("moved or resized");
  expect(click).toHaveBeenCalledOnce();
  await expect(handler("t0l0")).resolves.toBeUndefined();
});

test("window lookup errors propagate without breaking later invocations", async () => {
  const handler = buildClickHandler("dev.fixture");
  windowsMock.mockImplementationOnce(() => {
    throw new Error("could not enumerate windows");
  });
  await expect(handler("t0l0")).rejects.toThrow("could not enumerate windows");
  expect(click).not.toHaveBeenCalled();
  await expect(handler("t0l0")).resolves.toBeUndefined();
});
