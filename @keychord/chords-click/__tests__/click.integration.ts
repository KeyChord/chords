import assert from "node:assert/strict";
import { getAppWindows, getScreenBounds } from "chord";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import buildClickHandler, { clickPoints } from "../js/click.js";
import { chordPattern } from "@keychord/chordtest/patterns";

requireMacOSVM();
const [appId, output, coverId, coverOutput] = process.argv.slice(2);
type Event = {
  phase: "down" | "up" | "drag";
  x: number;
  y: number;
  timestamp: number;
  receivedAt: number;
  button: number;
  clickCount: number;
};
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
const initialBounds = getAppWindows(appId)[0].bounds;
assert.equal(getAppWindows(appId).length, 1);
const handler = buildClickHandler();
const context = { focusedAppId: appId };
await assert.rejects(handler.call(context, "20b51"));
await assert.rejects(handler.call(context, "20b5/00r601b"), /outside/);
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
  assert.equal(args.length, 2);
  const sequence = capture[Number(args[0].slice(1))];
  assert.equal(sequence, input.slice(1));
  await handler.call(context, sequence, args[1]);
}
await invokeChord(".20b5-53/07/00r20b65");
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
assert.deepEqual(clicked.cursor, { x: initialBounds.x + 180, y: initialBounds.y + 300 });
assert.equal(clicked.frontmostAppId, coverId);
assert.equal((await state(coverOutput)).events.length, 0);
for (let index = 2; index < clicked.events.length; index += 2) {
  const previousUp = clicked.events[index - 1];
  const nextDown = clicked.events[index];
  assert.ok(nextDown.timestamp - previousUp.timestamp >= 0.49);
  assert.ok(nextDown.receivedAt - previousUp.receivedAt >= 0.49);
}
console.log("click fixture: offsets, timing, cursor movement and background targeting passed");

let eventCount = 10;
const topLeft = { x: 30, y: 20 };
const bottomRight = { x: 250, y: 560 };
for (const [input, points] of [
  [".50r40b30l20t", [bottomRight, topLeft]],
  [".30l20t50r40b", [topLeft, bottomRight]],
  [".20t30l40b50r", [topLeft, bottomRight]],
  [".40b50r20t30l", [bottomRight, topLeft]],
  [
    ".91/21/23/4",
    [
      { x: 270, y: 72 },
      { x: 36, y: 204 },
    ],
  ],
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
console.log("click fixture: direction suffixes and mixed fractions run without separators");

await invokeChord("..-9,9228");
eventCount += 10;
await until(async () => (await state()).events.length === eventCount);
const doubleEvents = (await state()).events.slice(-10);
assert.ok(doubleEvents[2].receivedAt - doubleEvents[1].receivedAt < 1);
assert.ok(doubleEvents[8].receivedAt - doubleEvents[7].receivedAt < 1);
assert.deepEqual(
  doubleEvents
    .filter((event) => event.phase === "down")
    .map(({ x, y, button, clickCount }) => ({ x, y, button, clickCount })),
  [
    { x: 0, y: 540, button: 0, clickCount: 1 },
    { x: 0, y: 540, button: 0, clickCount: 2 },
    { x: 270, y: 120, button: 1, clickCount: 1 },
    { x: 60, y: 480, button: 0, clickCount: 1 },
    { x: 60, y: 480, button: 0, clickCount: 2 },
  ],
);
await invokeChord(".;0l9.9228");
eventCount += 6;
await until(async () => (await state()).events.length === eventCount);
assert.deepEqual(
  (await state()).events
    .slice(-6)
    .filter((event) => event.phase === "down")
    .map((event) => event.button),
  [2, 0, 2],
);
const targetBounds = getAppWindows(appId)[0];
await clickPoints({ ...targetBounds.bounds, windowId: targetBounds.windowId }, [
  { x: targetBounds.bounds.x + 30, y: targetBounds.bounds.y + 20, click: "long" },
]);
eventCount += 2;
await until(async () => (await state()).events.length === eventCount);
const press = (await state()).events.slice(-2);
assert.ok(press[1].receivedAt - press[0].receivedAt >= 0.48, "long press must hold for 500 ms");
assert.ok(
  press[1].timestamp - press[0].timestamp >= 0.48,
  "event timestamps must include the hold",
);
assert.deepEqual((await state()).cursor, {
  x: targetBounds.bounds.x + 30,
  y: targetBounds.bounds.y + 20,
});
assert.equal((await state()).frontmostAppId, coverId);
assert.equal((await state(coverOutput)).events.length, 0);
console.log("click fixture: double/right/middle overrides, reset and long press passed");

await Promise.all([handler.call(context, "30l20t"), handler.call(context, "50l40t")]);
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

for (const [input, button] of [
  [".-1328", 0],
  [".,-1328", 1],
  [".;-1328", 2],
] as const) {
  await invokeChord(input);
  eventCount += 3;
  await until(async () => (await state()).events.length === eventCount);
  assert.deepEqual(
    (await state()).events.slice(-3).map(({ phase, x, y, button }) => ({ phase, x, y, button })),
    [
      { phase: "down", x: 30, y: 180, button },
      { phase: "drag", x: 60, y: 480, button },
      { phase: "up", x: 60, y: 480, button },
    ],
  );
}
await invokeChord(".-1355-");
eventCount += 2;
await until(async () => (await state()).events.length === eventCount);
await Bun.sleep(100);
assert.equal((await state()).events.at(-1)!.phase, "drag");
await invokeChord(".=28");
eventCount += 2;
await until(async () => (await state()).events.length === eventCount);
assert.deepEqual(
  (await state()).events.slice(-2).map(({ phase, x, y }) => ({ phase, x, y })),
  [
    { phase: "drag", x: 60, y: 480 },
    { phase: "up", x: 60, y: 480 },
  ],
);
await invokeChord(".=55");
await Bun.sleep(100);
assert.equal((await state()).events.length, eventCount);
assert.deepEqual((await state()).cursor, { x: initialBounds.x + 150, y: initialBounds.y + 300 });
assert.equal((await state()).frontmostAppId, coverId);
assert.equal((await state(coverOutput)).events.length, 0);

for (const [input, button] of [
  [".13-", 0],
  [".,13-", 1],
  [".;13-", 2],
] as const) {
  await invokeChord(input);
  eventCount += 1;
  await until(async () => (await state()).events.length === eventCount);
  await assert.rejects(invokeChord(".13junk"), /coordinate/);
  eventCount += 1;
  await until(async () => (await state()).events.length === eventCount);
  assert.deepEqual(
    (await state()).events.slice(-2).map(({ phase, button }) => ({ phase, button })),
    [
      { phase: "down", button },
      { phase: "up", button },
    ],
  );
}
await invokeChord(".-13-");
eventCount += 1;
await until(async () => (await state()).events.length === eventCount);
await assert.rejects(invokeChord(".=301l5"), /outside/);
eventCount += 1;
await until(async () => (await state()).events.length === eventCount);
assert.deepEqual(
  (await state()).events.slice(-2).map((event) => event.phase),
  ["down", "up"],
);
console.log("click fixture: preflight failures release latched left/right/middle buttons");

// Move globally without clicks or focus changes, then click the covering fixture globally.
const screen = getScreenBounds();
await invokeChord("./=55");
await until(async () => (await state()).cursor.x === screen.x + screen.width / 2);
assert.deepEqual((await state()).cursor, {
  x: screen.x + screen.width / 2,
  y: screen.y + screen.height / 2,
});
assert.equal((await state()).events.length, eventCount);
const coverBounds = getAppWindows(coverId)[0].bounds;
const globalPoint = `${coverBounds.x - screen.x + 30}l${coverBounds.y - screen.y + 20}t`;
await invokeChord(`./${globalPoint}`);
await until(async () => (await state(coverOutput)).events.length === 2);
assert.deepEqual(
  (await state(coverOutput)).events.map(({ phase, x, y }) => ({ phase, x, y })),
  [
    { phase: "down", x: 30, y: 20 },
    { phase: "up", x: 30, y: 20 },
  ],
);
let coverEventCount = 2;
for (const [prefix, button, count] of [
  ["./.", 0, 2],
  ["./,", 1, 1],
  ["./;", 2, 1],
] as const) {
  await invokeChord(prefix + globalPoint);
  coverEventCount += count * 2;
  await until(async () => (await state(coverOutput)).events.length === coverEventCount);
  assert.deepEqual(
    (await state(coverOutput)).events
      .slice(-count * 2)
      .map(({ phase, x, y, button, clickCount }) => ({ phase, x, y, button, clickCount })),
    Array.from({ length: count }, (_, index) => [
      { phase: "down", x: 30, y: 20, button, clickCount: index + 1 },
      { phase: "up", x: 30, y: 20, button, clickCount: index + 1 },
    ]).flat(),
  );
}
const globalEnd = `${coverBounds.x - screen.x + 60}l${coverBounds.y - screen.y + 40}t`;
for (const [prefix, button] of [
  ["./-", 0],
  ["./,-", 1],
  ["./;-", 2],
] as const) {
  await invokeChord(prefix + globalPoint + globalEnd);
  coverEventCount += 3;
  await until(async () => (await state(coverOutput)).events.length === coverEventCount);
  assert.deepEqual(
    (await state(coverOutput)).events
      .slice(-3)
      .map(({ phase, x, y, button }) => ({ phase, x, y, button })),
    [
      { phase: "down", x: 30, y: 20, button },
      { phase: "drag", x: 60, y: 40, button },
      { phase: "up", x: 60, y: 40, button },
    ],
  );
}
assert.equal((await state()).events.length, eventCount);
console.log("click fixture: native drags, latched holds, movement and global input passed");

const sequence = handler.call(context, "30l20t50l40t");
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
const failedDrag = handler.call(context, "30l20t50l40t", "drag");
const rejectedDrag = assert.rejects(failedDrag, /moved or resized/);
eventCount += 1;
await until(async () => (await state()).events.length === eventCount);
await Bun.write(`${output}.command`, "resize");
await until(async () => {
  const bounds = getAppWindows(appId)[0]?.bounds;
  return bounds?.width === 400 && bounds.height === 500;
});
await rejectedDrag;
eventCount += 1;
await until(async () => (await state()).events.length === eventCount);
assert.deepEqual(
  (await state()).events.slice(-2).map((event) => event.phase),
  ["down", "up"],
);
await handler.call(context, "85");
eventCount += 2;
await until(async () => (await state()).events.length === eventCount);
const last = (await state()).events.at(-2)!;
assert.deepEqual({ x: last.x, y: last.y }, { x: 320, y: 250 });
await Bun.write(`${output}.command`, "hide");
await until(async () => !(await state()).visible && getAppWindows(appId).length === 0);
await assert.rejects(handler.call(context, "--"), /No on-screen window/);
console.log(
  "click-macos-events-ok: capture, background targeting, offsets, timing, queue, geometry changes, recovery",
);
