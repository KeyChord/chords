import { readFileSync } from "node:fs";
import { beforeEach, expect, mock, test } from "bun:test";
import { chordPattern } from "@keychord/chordtest/patterns";
import { waitFor } from "@keychord/chordtest/test";
import {
  parseClickSequence,
  resolveClickSequence,
  type ScreenBounds,
} from "@keychord/chords-click/sequence";

const native = { getScreenBounds: mock(), clickPoints: mock() };
const openAddon = mock();
mock.module("../src/js/utils/screen-continuity-native", () => ({
  openScreenContinuityAddon: openAddon,
}));
// The handler caches its addon and queue at module level; load a fresh instance per test.
let instance = 0;
const loadHandler = async () =>
  (await import(`../src/js/screen-continuity.ts?test=${instance}`))
    .default as typeof import("../src/js/screen-continuity").default;
const bounds: ScreenBounds = { x: 100, y: 200, width: 300, height: 600 };
const parseTap = (sequence: string) => parseClickSequence(sequence, undefined, 36);
const resolveTap = (sequence: string) => resolveClickSequence(parseTap(sequence), bounds);

beforeEach(() => {
  instance++;
  native.getScreenBounds.mockReset().mockResolvedValue(JSON.stringify(bounds));
  native.clickPoints.mockReset().mockResolvedValue(undefined);
  openAddon.mockReset().mockReturnValue(native);
});

test("each axis has 36 ordered positions, from 0 through z inclusive", () => {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const xs = [...alphabet].map((digit) => resolveTap(`${digit}i`)[0].x);
  const ys = [...alphabet].map((digit) => resolveTap(`i${digit}`)[0].y);
  expect(new Set(xs).size).toBe(36);
  expect(new Set(ys).size).toBe(36);
  expect(xs[0]).toBe(100);
  expect(xs[35]).toBe(399);
  expect(ys[0]).toBe(200);
  expect(ys[35]).toBe(799);
  for (let index = 1; index < 35; index++) {
    expect(xs[index]).toBeCloseTo(100 + (300 * index) / 35);
    expect(ys[index]).toBeCloseTo(200 + (600 * index) / 35);
    expect(xs[index]).toBeGreaterThan(xs[index - 1]);
    expect(ys[index]).toBeGreaterThan(ys[index - 1]);
  }
});

test("pairs run together and 00/zz identify opposite device corners", () => {
  expect(resolveTap("00z00zzz")).toEqual([
    { x: 100, y: 200 },
    { x: 399, y: 200 },
    { x: 100, y: 799 },
    { x: 399, y: 799 },
  ]);
});

test("bare l/r/t/b are base-36 digits rather than pixel directions", () => {
  const [first, second] = resolveTap("lrtb");
  expect(first.x).toBe(280); // l = 21/35
  expect(first.y).toBeCloseTo(662.8571428571429); // r = 27/35
  expect(second.x).toBeCloseTo(348.57142857142856); // t = 29/35
  expect(second.y).toBeCloseTo(388.57142857142856); // b = 11/35
  expect(resolveTap("20l5")).toHaveLength(2);
});

test("equals prefixes exact pixel offsets, in either axis order", () => {
  expect(resolveTap("=20l=30t=20b=30r")).toEqual([
    { x: 120, y: 230 },
    { x: 370, y: 780 },
  ]);
  expect(resolveTap("=0.5l=1.25t")).toEqual([{ x: 100.5, y: 201.25 }]);
  expect(resolveTap("=0r=0b")).toEqual([{ x: 399, y: 799 }]);
  expect(resolveTap("=20li")[0].y).toBeCloseTo(508.57142857142856);
});

test("fractional suffixes also use base 36 and allow exact percentages between steps", () => {
  expect(resolveTap("h/ih/i")).toEqual([{ x: 250, y: 500 }]); // (17 + 18/36)/35
  expect(resolveTap("a/io/i")).toEqual([{ x: 190, y: 620 }]); // 30%, 70%
  expect(resolveTap("0/00/0")).toEqual([{ x: 100, y: 200 }]);
});

test("tap, long press, drag and move modifiers retain their meanings", () => {
  expect(resolveTap("00,zz00")).toEqual([
    { x: 100, y: 200 },
    { x: 399, y: 799, click: "LONG" },
    { x: 100, y: 200 },
  ]);
  expect(resolveTap(".-00zz-")).toEqual([
    { x: 100, y: 200, click: "DRAG" },
    { x: 399, y: 799, click: "DRAG", hold: true },
  ]);
  expect(resolveTap(".=00zz")).toEqual([
    { x: 100, y: 200, click: "MOVE" },
    { x: 399, y: 799 },
  ]);
});

test.each(["", " ", "0", "00z", "--", "A3", "hello!", "=20", "=ii", "=20p0", "0/", "00,"])(
  "rejects malformed base-36 input %j",
  (sequence) => expect(() => parseTap(sequence)).toThrow(TypeError),
);

test.each(["=301l0", "0=601b", "z/1i", "iz/1"])(
  "rejects out-of-range offsets before clicking: %s",
  (sequence) => expect(() => resolveTap(sequence)).toThrow(RangeError),
);

test("the configured chord captures and forwards all base-36 pairs", async () => {
  const source = readFileSync(
    new URL("../chords/com/apple/ScreenContinuity/macos.toml", import.meta.url),
    "utf8",
  );
  const binding = source.match(/^'([^']+)' = .*'@input:tap' = \['(\$1)'\]/m)!;
  expect(binding[1]).toBe("t(.+)");
  expect(chordPattern(binding[1]).exec("t00zz")?.[1]).toBe("00zz");
  const buildHandler = await loadHandler();
  await buildHandler()("00zz");
  expect(native.clickPoints).toHaveBeenCalledTimes(1);
  expect(native.clickPoints).toHaveBeenCalledWith(
    JSON.stringify({
      bounds,
      points: [
        { x: 100, y: 200 },
        { x: 399, y: 799 },
      ],
    }),
  );
});

test.each([
  ["00", [{ x: 100, y: 200 }]],
  ["zz", [{ x: 399, y: 799 }]],
  ["=20l=30t", [{ x: 120, y: 230 }]],
  [".=00", [{ x: 100, y: 200, click: "MOVE" }]],
  [
    "-00zz",
    [
      { x: 100, y: 200, click: "DRAG" },
      { x: 399, y: 799, click: "DRAG" },
    ],
  ],
  [
    "-00zz-",
    [
      { x: 100, y: 200, click: "DRAG" },
      { x: 399, y: 799, click: "DRAG", hold: true },
    ],
  ],
] as const)("the tap handler dispatches the new syntax: %s", async (sequence, points) => {
  const buildHandler = await loadHandler();
  await buildHandler()(sequence);
  expect(native.clickPoints).toHaveBeenCalledTimes(1);
  expect(native.clickPoints).toHaveBeenCalledWith(JSON.stringify({ bounds, points }));
});

test.each(["00!", "=ii", "00=301l0"])(
  "invalid complete input never requests clicks: %s",
  async (sequence) => {
    const buildHandler = await loadHandler();
    await expect(buildHandler()(sequence)).rejects.toThrow();
    expect(native.clickPoints).not.toHaveBeenCalled();
  },
);

test("a malformed tail is rejected before native code loads", async () => {
  const buildHandler = await loadHandler();
  await expect(buildHandler()("00!")).rejects.toThrow();
  expect(openAddon).not.toHaveBeenCalled();
});

test("native connection errors propagate and the next sequence can run", async () => {
  const buildHandler = await loadHandler();
  const handler = buildHandler();
  native.getScreenBounds.mockRejectedValueOnce(new Error("iPhone Mirroring is not connected"));
  await expect(handler("00")).rejects.toThrow("not connected");
  expect(native.clickPoints).not.toHaveBeenCalled();
  await handler("zz");
  expect(native.clickPoints).toHaveBeenCalledOnce();
  expect(openAddon).toHaveBeenCalledOnce();
});

test("overlapping sequences wait until previous clicks finish", async () => {
  let finishFirst!: () => void;
  native.clickPoints.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishFirst = resolve;
      }),
  );
  const buildHandler = await loadHandler();
  const handler = buildHandler();
  const first = handler("00");
  const second = handler("zz");
  await waitFor(() => expect(native.clickPoints).toHaveBeenCalledOnce());
  expect(native.getScreenBounds).toHaveBeenCalledOnce();
  finishFirst();
  await Promise.all([first, second]);
  expect(native.getScreenBounds).toHaveBeenCalledTimes(2);
  expect(native.clickPoints).toHaveBeenNthCalledWith(
    2,
    JSON.stringify({ bounds, points: [{ x: 399, y: 799 }] }),
  );
});

test("a failed click does not block later sequences", async () => {
  const buildHandler = await loadHandler();
  const handler = buildHandler();
  native.clickPoints.mockRejectedValueOnce(new Error("window moved"));
  await expect(handler("00")).rejects.toThrow("window moved");
  await expect(handler("zz")).resolves.toBeUndefined();
});

test("h captures the same base-36 sequence and configures the hover handler", async () => {
  const source = readFileSync(
    new URL("../chords/com/apple/ScreenContinuity/macos.toml", import.meta.url),
    "utf8",
  );
  expect(source).toMatch(/\[on\.hover\]\s+file = 'screen-continuity\.js'\s+args = \['HOVER'\]/);
  const binding = source.match(/^'([^']+)' = .*'@input:hover' = \['(\$1)'\]/m)!;
  expect(chordPattern(binding[1]).exec("h00zz")?.[1]).toBe("00zz");
  const buildHandler = await loadHandler();
  await buildHandler("HOVER")("00zz");
  expect(native.clickPoints).toHaveBeenCalledTimes(1);
  expect(native.clickPoints).toHaveBeenCalledWith(
    JSON.stringify({
      bounds,
      points: [
        { x: 100, y: 200, click: "MOVE" },
        { x: 400, y: 800, click: "MOVE" },
      ],
      hover: true,
    }),
  );
});

test.each(["-00", "00-", ",00", ".00", ".-00", ";00"])(
  "hover rejects click and hold modifiers before native input: %s",
  async (sequence) => {
    const buildHandler = await loadHandler();
    await expect(buildHandler("HOVER")(sequence)).rejects.toThrow();
    expect(openAddon).not.toHaveBeenCalled();
  },
);

test("hover supports exact pixel offsets and fractional coordinates", async () => {
  const buildHandler = await loadHandler();
  await buildHandler("HOVER")("=20l=30th/ih/i");
  expect(native.clickPoints).toHaveBeenCalledTimes(1);
  expect(native.clickPoints).toHaveBeenCalledWith(
    JSON.stringify({
      bounds,
      points: [
        { x: 120, y: 230, click: "MOVE" },
        { x: 250, y: 500, click: "MOVE" },
      ],
      hover: true,
    }),
  );
});

test("tap and hover sequences share a queue", async () => {
  let finish!: () => void;
  native.clickPoints.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const buildHandler = await loadHandler();
  const tap = buildHandler()("00");
  const hover = buildHandler("HOVER")("zz");
  await waitFor(() => expect(native.clickPoints).toHaveBeenCalledOnce());
  expect(native.getScreenBounds).toHaveBeenCalledOnce();
  finish();
  await Promise.all([tap, hover]);
  expect(native.clickPoints).toHaveBeenNthCalledWith(
    2,
    JSON.stringify({
      bounds,
      points: [{ x: 400, y: 800, click: "MOVE" }],
      hover: true,
    }),
  );
});
