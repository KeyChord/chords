import assert from "node:assert/strict";
import buildSelectionHandler from "../js/selection.js";
import buildTrayHandler, { runMenuBarAction } from "../js/tray.js";
import buildMenuHandler from "../js/menu.js";
import buildVisibilityHandler from "../js/visibility.js";
import { chordPattern } from "@keychord/chordtest/patterns";
import { waitFor } from "@keychord/chordtest/macos";

const app = process.env.MENU_BAR_FIXTURE_APP!;
const output = process.env.MENU_FIXTURE_OUTPUT!;
const probeBinary = process.env.MENU_BAR_PROBE!;
const compiler = Bun.spawn(
  [
    "swiftc",
    Bun.fileURLToPath(new URL("./ControlCenterProbe.swift", import.meta.url)),
    "-o",
    probeBinary,
  ],
  { stderr: "inherit" },
);
assert.equal(await compiler.exited, 0);
type Entry = {
  x?: number;
  y?: number;
  notch?: boolean;
  autoHideMenuBar?: boolean;
  menuBarVisible?: boolean;
  title?: string;
  frame?: { x: number; y: number; width: number; height: number };
};
async function probe(...args: string[]): Promise<Entry[]> {
  const child = Bun.spawn([probeBinary, ...args], { stdout: "pipe", stderr: "inherit" });
  const text = await new Response(child.stdout).text();
  assert.equal(await child.exited, 0);
  return text ? JSON.parse(text) : [];
}
async function cursor() {
  const [point] = await probe("cursor");
  return { x: point.x!, y: point.y! };
}
const select = buildSelectionHandler();
async function hover(sequence: string) {
  await select.call(
    { focusedAppId: app, event: { type: "keydown", key: sequence.at(-1)!, repeat: false } },
    "KEYDOWN",
    sequence,
  );
  return cursor();
}
async function click(sequence: string, expected: string) {
  await Bun.write(output, "pending");
  await select.call({ focusedAppId: app, event: null }, "INPUT", sequence);
  await waitFor(async () => ((await Bun.file(output).text()) === expected ? true : undefined));
}

const menus = (await probe("menus", app)).filter((entry) => entry.frame && entry.frame.width > 0);
assert.ok(menus.length >= 5);
const apple = await hover("0");
assert.ok(Math.abs(apple.x - (menus[0].frame!.x + menus[0].frame!.width / 2)) < 1);
assert.deepEqual(await hover("[0"), apple);
assert.deepEqual(await hover("[0["), apple);
const firstTray = await hover("1");
assert.ok(firstTray.x > menus.at(-1)!.frame!.x);
assert.deepEqual(await hover("]1"), firstTray);
assert.deepEqual(await hover("1[[[["), firstTray);
assert.deepEqual(await hover("-1l["), firstTray);
const lastTray = await hover("-1");
assert.deepEqual(await hover("]1r"), lastTray);
assert.deepEqual(await hover("-1]]]]"), lastTray);
const lastMenu = await hover("[1r");
assert.deepEqual(await hover("[1r]]]]"), lastMenu);
assert.ok(lastMenu.x < firstTray.x);

// Indexing past the tray must reject, even when there are menus available to its left.
let trayCount = 0;
for (; trayCount < 200; trayCount++) {
  try {
    await runMenuBarAction({ scope: "TRAY", index: trayCount, steps: "" }, app);
  } catch (error) {
    assert.match(String(error), /could not find tray menu bar item at index/i);
    break;
  }
}
assert.ok(trayCount > 0 && trayCount < 200);
await assert.rejects(
  runMenuBarAction({ scope: "TRAY", index: -trayCount - 1, steps: "" }, app),
  /could not find tray menu bar item/i,
);
await assert.rejects(
  buildTrayHandler()("HOVER", -trayCount - 1),
  /could not find tray menu bar item/i,
);
await assert.rejects(buildTrayHandler()("HOVER", trayCount), /could not find tray menu bar item/i);
await assert.rejects(
  runMenuBarAction({ scope: "MENU", index: menus.length, steps: "" }, app),
  /could not find menu menu bar item/i,
);
assert.deepEqual(await hover(trayCount + "r[[[["), firstTray);

await click("[2.", "opened:File");
await click("[3.", "opened:Format");
await click("[1r.", "opened:Apple Tools");
const menu = buildMenuHandler(app);
// Dispatch letter search through the shipped TOML, including its terminating dot.
const { chords: bindings } = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, any> };
for (const sequence of ["=[f.", "=[z-o2."]) {
  const matches = Object.entries(bindings).flatMap(([pattern, binding]: [string, any]) => {
    const match = chordPattern(pattern).exec(sequence);
    return match && binding["@input:menu"] ? [{ match, args: binding["@input:menu"] }] : [];
  });
  assert.equal(matches.length, 1);
  await menu("BY_LETTERS", matches[0].args[1].replace("$1", matches[0].match[1]));
}
await waitFor(async () => ((await Bun.file(output).text()) === "Zoom Original" ? true : undefined));
if (!(await probe("display"))[0].notch) {
  await assert.rejects(buildTrayHandler()("NOTCH"), /could not find notch on the main display/);
}

// Move off the top edge so hovering there cannot keep an auto-hidden bar visible.
await probe("park");
const original = (await probe("display"))[0];
const toggleVisibility = buildVisibilityHandler();
try {
  await toggleVisibility();
  await waitFor(async () =>
    (await probe("display"))[0].autoHideMenuBar !== original.autoHideMenuBar ? true : undefined,
  );
  await waitFor(async () =>
    (await probe("display"))[0].menuBarVisible === original.autoHideMenuBar ? true : undefined,
  );
} finally {
  if ((await probe("display"))[0].autoHideMenuBar !== original.autoHideMenuBar)
    await toggleVisibility();
}
await waitFor(async () =>
  (await probe("display"))[0].autoHideMenuBar === original.autoHideMenuBar ? true : undefined,
);
console.log("menu bar integration passed");
