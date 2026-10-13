import { readFileSync } from "node:fs";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import { chordPattern } from "@keychord/chordtest/patterns";
import {
  parseClickSequence,
  resolveClickSequence,
  type ScreenBounds,
} from "@keychord/chords-click/sequence";

const native = vi.hoisted(() => ({ getScreenBounds: vi.fn(), clickPoints: vi.fn() }));
const openAddon = vi.hoisted(() => vi.fn());
vi.mock("../src/js/utils/screen-continuity-native", () => ({
  openScreenContinuityAddon: openAddon,
}));
const bounds: ScreenBounds = { x: 100, y: 200, width: 300, height: 600 };
const example = "20b5-53/07/00r20b65";
const expectedPoints = [
  { x: 250, y: 780 },
  { x: 100, y: 500 },
  { x: 190, y: 620 },
  { x: 399, y: 780 },
  { x: 280, y: 500 },
];
beforeEach(() => {
  vi.resetModules();
  native.getScreenBounds.mockReset().mockResolvedValue(JSON.stringify(bounds));
  native.clickPoints.mockReset().mockResolvedValue(undefined);
  openAddon.mockReset().mockReturnValue(native);
});

test("the compact sequence resolves all five clicks in order", () => {
  expect(resolveClickSequence(parseClickSequence(example), bounds)).toEqual(expectedPoints);
});
test("zero fractional tenths keep shorthand distinct from a following pixel amount", () => {
  expect(resolveClickSequence(parseClickSequence("13/020l5"), bounds)).toEqual([
    { x: 130, y: 380 },
    { x: 120, y: 500 },
  ]);
});
test("a slash always refines its coordinate instead of separating pairs", () => {
  expect(resolveClickSequence(parseClickSequence("13/20l5"), bounds)).toEqual([
    { x: 130, y: 392 },
    { x: 100, y: 500 },
  ]);
});
test("each unsuffixed digit is one axis in tenths, starting from the top left", () => {
  expect(resolveClickSequence(parseClickSequence("1313"), bounds)).toEqual([
    { x: 130, y: 380 },
    { x: 130, y: 380 },
  ]);
});
test.each([
  ["91/2", { x: 370, y: 272 }],
  ["1/23", { x: 136, y: 380 }],
  ["1/23/4", { x: 136, y: 404 }],
  ["-/2-/5", { x: 106, y: 230 }],
  ["9/90/0", { x: 397, y: 799 }],
  ["1/03/0", { x: 130, y: 380 }],
] as const)("mixed fractions refine either axis to hundredths: %s", (sequence, point) => {
  expect(resolveClickSequence(parseClickSequence(sequence), bounds)).toEqual([point]);
});
test("mixed-fraction pairs run together and preserve one-pair click overrides", () => {
  expect(resolveClickSequence(parseClickSequence("91/2,1/23/491/2", "double"), bounds)).toEqual([
    { x: 370, y: 272, click: "double" },
    { x: 136, y: 404, click: "right" },
    { x: 370, y: 272, click: "double" },
  ]);
});
test("direction suffixes make the complete number an exact pixel offset", () => {
  expect(resolveClickSequence(parseClickSequence("20l5/020t5/020l30t"), bounds)).toEqual([
    { x: 120, y: 500 },
    { x: 250, y: 220 },
    { x: 120, y: 230 },
  ]);
});
test("pixel directions keep one pixel distinct from ten percent", () => {
  expect(resolveClickSequence(parseClickSequence("1l1t.11"), bounds)).toEqual([
    { x: 101, y: 201 },
    { x: 130, y: 260 },
  ]);
});
test("direction suffixes measure exact pixels from each named edge", () => {
  expect(resolveClickSequence(parseClickSequence("1r3b.20r30b"), bounds)).toEqual([
    { x: 399, y: 797 },
    { x: 380, y: 770 },
  ]);
});
test("absolute coordinate directions may be written in either axis order", () => {
  expect(resolveClickSequence(parseClickSequence("20l5/020t5/020l30t20r30b"), bounds)).toEqual([
    { x: 120, y: 500 },
    { x: 250, y: 220 },
    { x: 120, y: 230 },
    { x: 380, y: 770 },
  ]);
});
test("relative and explicit zero reach the corresponding edges inside the window", () => {
  expect(resolveClickSequence(parseClickSequence("--0r0b300l600t300r600b"), bounds)).toEqual([
    { x: 100, y: 200 },
    { x: 399, y: 799 },
    { x: 399, y: 799 },
    { x: 100, y: 200 },
  ]);
});
test("zero means 100 percent and dash means zero percent on either axis", () => {
  expect(resolveClickSequence(parseClickSequence("0--000"), bounds)).toEqual([
    { x: 399, y: 200 },
    { x: 100, y: 799 },
    { x: 399, y: 799 },
  ]);
});
test("pixel offsets support decimal precision", () => {
  expect(resolveClickSequence(parseClickSequence("0.5l1.25t0.3r0.3b"), bounds)).toEqual([
    { x: 100.5, y: 201.25 },
    { x: 399.7, y: 799.7 },
  ]);
});
test("coordinates retain negative display origins and use resized dimensions", () => {
  expect(
    resolveClickSequence(parseClickSequence("85"), { x: -500, y: -300, width: 200, height: 400 }),
  ).toEqual([{ x: -340, y: -100 }]);
});
test("tap commas mark one long press and subsequent coordinates return to normal taps", () => {
  expect(resolveClickSequence(parseClickSequence("13,9228"), bounds)).toEqual([
    { x: 130, y: 380 },
    { x: 370, y: 320, click: "long" },
    { x: 160, y: 680 },
  ]);
});
test("click overrides apply to one pair and reset to the initial type", () => {
  expect(resolveClickSequence(parseClickSequence("-9,9228;45.67..89", "double"), bounds)).toEqual([
    { x: 100, y: 740, click: "double" },
    { x: 370, y: 320, click: "right" },
    { x: 160, y: 680, click: "double" },
    { x: 220, y: 500, click: "middle" },
    { x: 280, y: 620, click: "left" },
    { x: 340, y: 740, click: "double" },
  ]);
});
test.each([
  "",
  " ",
  "1",
  "131",
  "20p",
  "20,5",
  "5.5",
  "-",
  "a3",
  "1e2",
  "=20,5",
  "13junk",
  "135",
  "13-20p",
  "b20l5",
  "1,3",
  "..13",
  ";13",
  "13,",
  "91/",
  "91/-",
  "91/a",
  "91/2/3",
  "13//28",
  "20l5/0r601b",
  "9007199254740992l-",
  "9007199254740992r-",
  "9".repeat(400) + "l-",
])("rejects the complete malformed tap sequence %j", (sequence) => {
  expect(() => parseClickSequence(sequence)).toThrow(TypeError);
});
test.each(["0l601t", "301l-", "20b5/00r601b", "301r-"])(
  "rejects out-of-bounds pixels %s",
  (sequence) => {
    expect(() => resolveClickSequence(parseClickSequence(sequence), bounds)).toThrow(RangeError);
  },
);
test.each(["90/1", "0/19"])("rejects mixed fractions beyond 100 percent: %s", (sequence) => {
  expect(() => resolveClickSequence(parseClickSequence(sequence), bounds)).toThrow(RangeError);
});
test.each([
  { ...bounds, width: 0 },
  { ...bounds, height: -1 },
  { ...bounds, x: NaN },
  { ...bounds, y: Infinity },
])("rejects invalid native bounds %j", (invalidBounds) => {
  expect(() => resolveClickSequence(parseClickSequence("13"), invalidBounds)).toThrow(
    "invalid bounds",
  );
});

test("the configured chord captures and forwards the full sequence to the native handler", async () => {
  const source = readFileSync(
    new URL("../chords/com/apple/ScreenContinuity/macos.toml", import.meta.url),
    "utf8",
  );
  expect(source).toMatch(/\[on\.tap\]\s+file = 'screen-continuity\.js'/);
  const binding = source.match(/^'([^']+)' = .*'@input:tap' = \['(\$1)'\]/m);
  expect(binding).not.toBeNull();
  expect(binding![1]).toBe("t(.+)");
  expect(binding![2]).toBe("$1");
  expect(chordPattern(binding![1]).exec(`t${example}`)?.[1]).toBe(example);
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  await buildHandler()(example);
  expect(native.clickPoints).toHaveBeenCalledWith(
    JSON.stringify({ bounds, points: expectedPoints }),
  );
});

test("the tap chord forwards mixed fractions without pair separators", async () => {
  const source = readFileSync(
    new URL("../chords/com/apple/ScreenContinuity/macos.toml", import.meta.url),
    "utf8",
  );
  const binding = source.match(/^'([^']+)' = .*'@input:tap' = \['(\$1)'\]/m)!;
  const sequence = chordPattern(binding[1]).exec("t91/21/23/4")?.[1];
  expect(sequence).toBe("91/21/23/4");
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  await buildHandler()(sequence!);
  expect(native.clickPoints).toHaveBeenCalledExactlyOnceWith(
    JSON.stringify({
      bounds,
      points: [
        { x: 370, y: 272 },
        { x: 136, y: 404 },
      ],
    }),
  );
});

test("malformed trailing input never activates the app or requests clicks", async () => {
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  await expect(buildHandler()("20b5.1")).rejects.toThrow();
  expect(openAddon).not.toHaveBeenCalled();
  expect(native.getScreenBounds).not.toHaveBeenCalled();
  expect(native.clickPoints).not.toHaveBeenCalled();
});

test("an out-of-bounds final click prevents the entire native sequence", async () => {
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  await expect(buildHandler()("20b5/00r601b")).rejects.toThrow("outside");
  expect(native.clickPoints).not.toHaveBeenCalled();
});

test("native connection errors propagate and the next sequence can run", async () => {
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  const handler = buildHandler();
  native.getScreenBounds.mockRejectedValueOnce(new Error("iPhone Mirroring is not connected"));
  await expect(handler(example)).rejects.toThrow("not connected");
  expect(native.clickPoints).not.toHaveBeenCalled();
  await handler(example);
  expect(native.clickPoints).toHaveBeenCalledOnce();
  expect(openAddon).toHaveBeenCalledOnce();
});

test("overlapping sequences wait until all previous native clicks finish", async () => {
  let finishFirst!: () => void;
  native.clickPoints.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishFirst = resolve;
      }),
  );
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  const handler = buildHandler();
  const first = handler("20b5");
  const second = handler("55");
  await vi.waitFor(() => expect(native.clickPoints).toHaveBeenCalledOnce());
  expect(native.getScreenBounds).toHaveBeenCalledOnce();
  finishFirst();
  await Promise.all([first, second]);
  expect(native.getScreenBounds).toHaveBeenCalledTimes(2);
  expect(native.clickPoints).toHaveBeenNthCalledWith(
    2,
    JSON.stringify({ bounds, points: [{ x: 250, y: 500 }] }),
  );
});

test("a failed native click does not block later sequences", async () => {
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  const handler = buildHandler();
  native.clickPoints.mockRejectedValueOnce(new Error("window moved"));
  await expect(handler(example)).rejects.toThrow("window moved");
  await expect(handler(example)).resolves.toBeUndefined();
});

test.each([
  [
    "-1328",
    [
      { x: 130, y: 380, click: "drag" },
      { x: 160, y: 680, click: "drag" },
    ],
  ],
  [
    "-1328-",
    [
      { x: 130, y: 380, click: "drag" },
      { x: 160, y: 680, click: "drag", hold: true },
    ],
  ],
  ["=13", [{ x: 130, y: 380, click: "move" }]],
  ["13-", [{ x: 130, y: 380, click: "drag", hold: true }]],
] as const)("tap commands support drag, hold and movement: %s", async (sequence, points) => {
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  await buildHandler()(sequence);
  expect(native.clickPoints).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ bounds, points }));
});
