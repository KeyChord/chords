import { readFileSync } from "node:fs";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import {
  parseClickSequence,
  resolveClickSequence,
  type ScreenBounds,
} from "../src/js/utils/click-sequence";

const native = vi.hoisted(() => ({ getScreenBounds: vi.fn(), clickPoints: vi.fn() }));
const openAddon = vi.hoisted(() => vi.fn());
vi.mock("../src/js/utils/screen-continuity-native", () => ({
  openScreenContinuityAddon: openAddon,
}));

const bounds: ScreenBounds = { x: 100, y: 200, width: 300, height: 600 };
const example = "b20l.5b.5l0b.3l.3b20r0b.5r.4";
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

test("the supplied compact sequence resolves all five clicks in order", () => {
  expect(resolveClickSequence(parseClickSequence(example), bounds)).toEqual(expectedPoints);
});

test("spaces are optional and do not separate or change click positions", () => {
  expect(
    resolveClickSequence(parseClickSequence("b20l.5 b.5l0 b.3l.3 b20r0 b.5r.4"), bounds),
  ).toEqual(expectedPoints);
});

test("all edge combinations support either axis order", () => {
  const pairs = [
    ["t20l30", "l30t20", { x: 130, y: 220 }],
    ["t20r30", "r30t20", { x: 370, y: 220 }],
    ["b20l30", "l30b20", { x: 130, y: 780 }],
    ["b20r30", "r30b20", { x: 370, y: 780 }],
  ] as const;
  for (const [verticalFirst, horizontalFirst, point] of pairs) {
    for (const sequence of [verticalFirst, horizontalFirst]) {
      expect(resolveClickSequence(parseClickSequence(sequence), bounds)).toEqual([point]);
    }
  }
});

test("leading-dot offsets scale by the corresponding axis, including multiple digits", () => {
  expect(resolveClickSequence(parseClickSequence("t.25r.05"), bounds)).toEqual([
    { x: 385, y: 350 },
  ]);
});

test("integer one is a pixel, while leading-dot decimals are fractions", () => {
  expect(resolveClickSequence(parseClickSequence("t1l1t.1l.1"), bounds)).toEqual([
    { x: 101, y: 201 },
    { x: 130, y: 260 },
  ]);
});

test("decimal numbers beginning with a digit are absolute pixel offsets", () => {
  expect(resolveClickSequence(parseClickSequence("t20.5r30.25"), bounds)).toEqual([
    { x: 369.75, y: 220.5 },
  ]);
});

test("coordinates retain negative display origins and use resized window dimensions", () => {
  expect(
    resolveClickSequence(parseClickSequence("t.5r.25"), {
      x: -500,
      y: -300,
      width: 200,
      height: 400,
    }),
  ).toEqual([{ x: -350, y: -100 }]);
});

test("zero edge offsets stay inside the mirrored screen", () => {
  expect(resolveClickSequence(parseClickSequence("t0l0b0r0"), bounds)).toEqual([
    { x: 100, y: 200 },
    { x: 399, y: 799 },
  ]);
});

test("nonzero subpixel offsets retain their distance from the right and bottom edges", () => {
  expect(resolveClickSequence(parseClickSequence("b.0005r.001"), bounds)).toEqual([
    { x: 399.7, y: 799.7 },
  ]);
});

test.each([
  "",
  " ",
  "b",
  "b20",
  "b20l",
  "b.l.5",
  "b-20l.5",
  "b1.l20",
  "b20b.5",
  "l20r30",
  "x20l.5",
  "b20l.5junk",
  "b20l.5b10",
  "b20l.5r10r20",
  "b9007199254740992l0",
])("rejects the entire malformed sequence %j", (sequence) => {
  expect(() => parseClickSequence(sequence)).toThrow(TypeError);
});

test.each(["b601l0", "t0r301", "b20l.5b601r0"])(
  "rejects offsets outside the phone screen: %s",
  (sequence) => {
    expect(() => resolveClickSequence(parseClickSequence(sequence), bounds)).toThrow(RangeError);
  },
);

test.each([
  { ...bounds, width: 0 },
  { ...bounds, height: -1 },
  { ...bounds, x: NaN },
  { ...bounds, y: Infinity },
])("rejects invalid native bounds %j", (invalidBounds) => {
  expect(() => resolveClickSequence(parseClickSequence("b20l.5"), invalidBounds)).toThrow(
    "invalid bounds",
  );
});

test("the configured chord captures and forwards the full sequence to the native handler", async () => {
  const source = readFileSync(
    new URL("../chords/com/apple/ScreenContinuity/macos.toml", import.meta.url),
    "utf8",
  );
  expect(source).toMatch(/\[on\.click\]\s+file = 'screen-continuity\.js'/);
  const binding = source.match(/^'([^']+)' = .*'@input:click' = \['(\$1)'\]/m);
  expect(binding).not.toBeNull();
  const capture = new RegExp(`^(?:${binding![1]})$`).exec(`j.${example}`);
  expect(capture?.[1]).toBe(example);
  expect(new RegExp(`^(?:${binding![1]})$`).test("j.")).toBe(false);
  expect(new RegExp(`^(?:${binding![1]})$`).test(`j,${example}`)).toBe(false);
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  await buildHandler()(capture![1]);
  expect(native.clickPoints).toHaveBeenCalledWith(
    JSON.stringify({ bounds, points: expectedPoints }),
  );
});

test("malformed trailing input never activates the app or requests clicks", async () => {
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  await expect(buildHandler()("b20l.5b10")).rejects.toThrow();
  expect(openAddon).not.toHaveBeenCalled();
  expect(native.getScreenBounds).not.toHaveBeenCalled();
  expect(native.clickPoints).not.toHaveBeenCalled();
});

test("an out-of-bounds final click prevents the entire native sequence", async () => {
  const { default: buildHandler } = await import("../src/js/screen-continuity");
  await expect(buildHandler()("b20l.5b601r0")).rejects.toThrow("outside");
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
  const first = handler("b20l.5");
  const second = handler("t.5r.5");
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
