import assert from "node:assert/strict";
import { getAppWindows } from "chord";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import buildClickHandler from "../js/click.js";
import { chordPattern } from "@keychord/chordtest/patterns";

requireMacOSVM();
const [appId, output, coverId, coverOutput] = process.argv.slice(2);
type Event = { phase: "down" | "up"; x: number; y: number; timestamp: number };
type State = {
  events: Event[];
  cursor: { x: number; y: number };
  frontmostAppId: string;
  width: number;
  height: number;
  visible: boolean;
};
async function state(path = output): Promise<State> {
  return Bun.file(path).json();
}
async function until(predicate: () => Promise<boolean>) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await Bun.sleep(20);
  }
  throw new Error("Timed out waiting for AppKit fixture state");
}
await until(async () => (await state()).frontmostAppId === coverId);
// AppKit and WindowServer publish geometry asynchronously after launch and resize.
await until(async () => {
  const before = getAppWindows(appId)[0]?.bounds;
  await Bun.sleep(200);
  return !!before && JSON.stringify(getAppWindows(appId)[0]?.bounds) === JSON.stringify(before);
});
const initial = await state();
assert.equal(getAppWindows(appId).length, 1);
const handler = buildClickHandler();
const context = { focusedAppId: appId };
await assert.rejects(handler.call(context, "b20l.5b10"));
await assert.rejects(handler.call(context, "b20l.5b601r0"), /outside/);
assert.equal((await state()).events.length, 0);
console.log("click fixture: validated input and stable background window");

const toml = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as any;
const bindings = Object.entries(toml.chords).filter(
  ([, binding]) => (binding as any)["@input:click"],
);
async function invokeChord(input: string) {
  const matches = bindings.flatMap(([pattern, binding]) => {
    const capture = chordPattern(pattern).exec(input);
    return capture ? [{ capture, binding: binding as any }] : [];
  });
  assert.equal(matches.length, 1);
  const { capture, binding } = matches[0];
  const args = binding["@input:click"];
  assert.equal(args.length, 1);
  const sequence = capture[Number(args[0].slice(1))];
  assert.equal(sequence, input.slice(1));
  await handler.call(context, sequence);
}
await invokeChord(".b20l.5b.5l0b.3l.3b20r0b.5r.4");
await until(async () => (await state()).events.length === 10);
const clicked = await state();
assert.deepEqual(
  clicked.events.filter((event) => event.phase === "down").map(({ x, y }) => ({ x, y })),
  [
    { x: 150, y: 580 },
    { x: 0, y: 300 },
    { x: 90, y: 420 },
    { x: 299, y: 580 },
    { x: 180, y: 300 },
  ],
);
assert.deepEqual(
  clicked.events.map((event) => event.phase),
  Array.from({ length: 5 }, () => ["down", "up"]).flat(),
);
assert.deepEqual(clicked.cursor, initial.cursor);
assert.equal(clicked.frontmostAppId, coverId);
assert.equal((await state(coverOutput)).events.length, 0);
const down = clicked.events.filter((event) => event.phase === "down");
for (let index = 1; index < down.length; index++)
  assert.ok(down[index].timestamp - down[index - 1].timestamp >= 0.19);
console.log("click fixture: offsets, timing, pointer and background targeting passed");

let eventCount = 10;
const topLeft = { x: 30, y: 20 };
const bottomRight = { x: 250, y: 560 };
for (const [input, points] of [
  [".b40r50t20l30", [bottomRight, topLeft]],
  [".t20l30b40r50", [topLeft, bottomRight]],
  [".l30t20r50b40", [topLeft, bottomRight]],
  [".r50b40t20l30", [bottomRight, topLeft]],
] as const) {
  await invokeChord(input);
  eventCount += 4;
  await until(async () => (await state()).events.length === eventCount);
  assert.deepEqual(
    (await state()).events
      .filter((event) => event.phase === "down")
      .slice(-2)
      .map(({ x, y }) => ({ x, y })),
    points,
  );
}
console.log("click fixture: all four dot-letter entry points accept mixed-edge sequences");

await Promise.all([handler.call(context, "t20l30"), handler.call(context, "t40l50")]);
eventCount += 4;
await until(async () => (await state()).events.length === eventCount);
assert.deepEqual(
  (await state()).events
    .filter((event) => event.phase === "down")
    .slice(-2)
    .map(({ x, y }) => ({ x, y })),
  [
    { x: 30, y: 20 },
    { x: 50, y: 40 },
  ],
);
console.log("click fixture: overlapping sequences passed");

const sequence = handler.call(context, "t20l30t40l50");
// Attach rejection handling immediately while the fixture changes its window.
const rejected = assert.rejects(sequence, /moved or resized/);
eventCount += 2;
await until(async () => (await state()).events.length === eventCount);
const previous = getAppWindows(appId)[0].bounds;
await Bun.write(`${output}.command`, "move");
await until(async () => getAppWindows(appId)[0].bounds.x !== previous.x);
await rejected;
assert.equal((await state()).events.length, eventCount);
console.log("click fixture: moving window rejected the remaining input");
await Bun.write(`${output}.command`, "resize");
await until(async () => {
  const bounds = getAppWindows(appId)[0]?.bounds;
  return bounds?.width === 400 && bounds.height === 500;
});
await handler.call(context, "t.5r.25");
eventCount += 2;
await until(async () => (await state()).events.length === eventCount);
const last = (await state()).events.at(-2)!;
assert.deepEqual({ x: last.x, y: last.y }, { x: 300, y: 250 });
await Bun.write(`${output}.command`, "hide");
await until(async () => !(await state()).visible && getAppWindows(appId).length === 0);
await assert.rejects(handler.call(context, "t0l0"), /No on-screen window/);
console.log(
  "click-macos-events-ok: capture, background targeting, offsets, timing, queue, geometry changes, recovery",
);
