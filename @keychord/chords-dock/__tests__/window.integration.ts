import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { waitFor } from "@keychord/chordtest/macos";
import { chordPattern } from "@keychord/chordtest/patterns";
import buildWindowHandler from "../js/window.js";

requireMacOSVM();
const [appId, output, coverId, coverOutput] = process.argv.slice(2);
type Bounds = { x: number; y: number; width: number; height: number };
type State = Bounds & { screen: Bounds; frontmostAppId: string };
const state = (path = output): Promise<State> => Bun.file(path).json();
const initial = await state();
const cover = await state(coverOutput);
const screen = initial.screen;
await waitFor(async () => ((await state()).frontmostAppId === coverId ? true : undefined));
const handler = buildWindowHandler();
const context = { focusedAppId: appId };
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as any;
async function invoke(input: string, expected: Partial<Bounds>) {
  const matches = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
    const capture = chordPattern(pattern).exec(input);
    const args = (binding as any)["@input:window"];
    return capture && args ? [{ capture, args }] : [];
  });
  assert.ok(matches.length > 0);
  const { capture, args } = matches[0];
  await handler.call({ ...context, input }, args[0], capture[Number(args[1].slice(1))]);
  try {
    await waitFor(async () => {
      const current = await state();
      return Object.entries(expected).every(
        ([key, value]) => Math.abs(current[key as keyof Bounds] - value!) <= 1,
      )
        ? current
        : undefined;
    });
  } catch (cause) {
    throw new Error(
      `${input}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(await state())}`,
      { cause },
    );
  }
  assert.equal((await state()).frontmostAppId, coverId);
  const currentCover = await state(coverOutput);
  for (const key of ["x", "y", "width", "height"] as const)
    assert.equal(currentCover[key], cover[key]);
}

await invoke("/ws22", { width: screen.width / 2, height: screen.height / 2 });
await invoke("/ws200x", { width: 200, height: screen.height / 2 });
await invoke("/wsh1", { width: 200, height: screen.height });
await invoke("/ws200x200", { width: 200, height: 200 });
await invoke("/wsh250x", { width: 200, height: 250 });
await invoke("/ws-1", { width: screen.width * 2, height: 250 });
await invoke("/ws200x200", { width: 200, height: 200 });
await invoke("/wp00", { x: screen.x, y: screen.y, width: 200, height: 200 });
await invoke("/wp22", { x: screen.x + screen.width / 2, y: screen.y + screen.height / 2 });
await invoke("/wpr1", { x: screen.x + screen.width - 200, y: screen.y + screen.height / 2 });
await invoke("/wp-1", { x: screen.x - screen.width, y: screen.y + screen.height / 2 });
await invoke("/wp-2", { x: screen.x - screen.width / 2, y: screen.y + screen.height / 2 });
await invoke("/wp200x200", { x: screen.x + 200, y: screen.y + 200 });
await invoke("/wph-2", { x: screen.x + 200, y: screen.y - screen.height / 2 });
await invoke("/wp-200x-100", { x: screen.x - 200, y: screen.y - 100 });
await invoke("/wp00", { x: screen.x, y: screen.y });
const before = await state();
await assert.rejects(handler.call(context, "size", "200x0"));
await assert.rejects(
  handler.call({ focusedAppId: "dev.keychord.nonexistent" }, "position", "r1"),
  /not running/,
);
for (const key of ["x", "y", "width", "height"] as const)
  assert.equal((await state())[key], before[key]);
await invoke("/ws22", { width: screen.width / 2, height: screen.height / 2 });
console.log(
  "window-macos-geometry-ok: size, position, negative offsets, right anchor, captured app, recovery",
);
