import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { waitFor } from "@keychord/chordtest/macos";
import { chordPattern } from "@keychord/chordtest/patterns";
import buildWindowHandler from "../js/window.js";

requireMacOSVM();
const [appId, output] = process.argv.slice(2);
type State = { frame: number[]; visibleFrame: number[]; primaryTop: number };
const state = (): Promise<State> => Bun.file(output).json();
const initial = await state();
const [sx, sy, sw, sh] = initial.visibleFrame;
const top = initial.primaryTop - sy - sh;
const handler = buildWindowHandler();
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as any;
async function invoke(input: string, frame: number[]) {
  const entry = Object.entries(definition.chords).find(
    ([pattern, binding]) => (binding as any)["@input:window"] && chordPattern(pattern).test(input),
  );
  assert.ok(entry, input);
  const [pattern, binding] = entry;
  const capture = chordPattern(pattern).exec(input)!;
  const args = (binding as any)["@input:window"].map((arg: string) =>
    arg.replace(/\$(\d+)/g, (_, index) => capture[Number(index)]),
  );
  await handler.call({ focusedAppId: appId, input }, args[0], args[1]);
  try {
    await waitFor(async () =>
      (await state()).frame.every((value, index) => Math.abs(value - frame[index]) <= 1)
        ? true
        : undefined,
    );
  } catch (cause) {
    throw new Error(
      `${input}: expected ${JSON.stringify(frame)}, got ${JSON.stringify((await state()).frame)}`,
      { cause },
    );
  }
}
await invoke("/w1100", [sx, sy, sw, sh]);
await invoke("/w2200", [sx, sy + sh / 2, sw / 2, sh / 2]);
await invoke("/w0022", [sx + sw / 2, sy, sw / 2, sh / 2]);
await invoke("/wtl", [sx, sy + sh / 2, sw / 2, sh / 2]);
await invoke("/wbr", [sx + sw / 2, sy, sw / 2, sh / 2]);
await invoke("/wlr", [sx, sy, sw, sh / 2]);
await invoke("/wtb", [sx, sy, sw, sh]);
await invoke("/wd200x200", [sx, sy + sh - 200, 200, 200]);
await invoke("/wp200x100", [sx + 200, initial.primaryTop - top - 100 - 200, 200, 200]);
// Full-screen dimensions must extend beyond the right/bottom borders at the original origin.
await invoke("/wd11", [sx + 200, sy - 100, sw, sh]);
await invoke("/w1100", [sx, sy, sw, sh]);
await invoke("/wdw2", [sx, sy, sw / 2, sh]);
await invoke("/wdh2", [sx, sy + sh / 2, sw / 2, sh / 2]);
await invoke("/wpx2", [sx + sw / 2, sy + sh / 2, sw / 2, sh / 2]);
await invoke("/wpy2", [sx + sw / 2, sy, sw / 2, sh / 2]);
// Ordinary AppKit retains a visible strip when this small window would be fully offscreen.
await assert.rejects(
  handler.call({ focusedAppId: appId, input: "/wpx-1" }, "POSITION", "-1"),
  /constrained.*requested/s,
);
await invoke("/wpx2", [sx + sw / 2, sy, sw / 2, sh / 2]);
await invoke("/wdw1", [sx + sw / 2, sy, sw, sh / 2]);
await invoke("/wpx-2", [sx - sw / 2, sy, sw, sh / 2]);
await invoke("/w1100", [sx, sy, sw, sh]);
await invoke("/wdw=0", [sx, sy, sw * 2, sh]);
await invoke("/wp-1", [sx - sw, sy, sw * 2, sh]);
console.log(
  "standard-window-geometry-ok: full frame, zero size axes, snaps, stretches, named axes, overflow",
);
