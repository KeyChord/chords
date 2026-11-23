import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { waitFor } from "@keychord/chordtest/macos";
import { chordPattern, type ChordPlaceholders } from "@keychord/chordtest/patterns";
import buildMonitorHandler from "../js/monitor.js";

requireMacOSVM();
const [appId, output, coverId] = process.argv.slice(2);
type State = {
  frontmostAppId: string;
  cursor: { x: number; y: number };
  center: { x: number; y: number };
  frame: number[];
  clicks: number;
  keyWindow: boolean;
};
const state = (): Promise<State> => Bun.file(output).json();
await waitFor(async () => ((await state()).frontmostAppId === coverId ? true : undefined));
const initial = await state();
const handler = buildMonitorHandler();
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { placeholders: ChordPlaceholders; chords: Record<string, { "@input:monitor"?: string[] }> };
const bindings = Object.entries(definition.chords).filter(
  ([, binding]) => binding["@input:monitor"],
);
function run(sequence: string) {
  const matches = bindings.flatMap(([pattern, binding]) => {
    const capture = chordPattern(pattern, definition.placeholders).exec(sequence);
    return capture ? [binding["@input:monitor"]![0].replace("$1", capture[1])] : [];
  });
  assert.equal(matches.length, 1, sequence);
  return handler(matches[0]);
}
await assert.rejects(run(";m999999"), /does not exist/);
await run(";m1");
await waitFor(async () => ((await state()).frontmostAppId === appId ? true : undefined));
for (const sequence of [";m[", ";m]", ";m1"]) {
  await run(sequence);
  await waitFor(async () => {
    const current = await state();
    return current.frontmostAppId === appId &&
      current.keyWindow &&
      Math.abs(current.cursor.x - current.center.x) <= 1 &&
      Math.abs(current.cursor.y - current.center.y) <= 1
      ? true
      : undefined;
  });
  const current = await state();
  assert.equal(current.frontmostAppId, appId);
  assert.equal(current.keyWindow, true);
  assert.deepEqual(current.frame, initial.frame);
  assert.equal(current.clicks, 0);
}
for (const [sequence, direction] of [
  [";ml", "LEFT"],
  [";mr", "RIGHT"],
  [";mt", "UP"],
  [";mb", "DOWN"],
]) {
  await assert.rejects(run(sequence), new RegExp(`No monitor to the ${direction}`));
}
console.log("monitor-macos-focus-ok: activation, pointer, bounds, queue recovery");
