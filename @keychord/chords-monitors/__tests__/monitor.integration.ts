import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { waitFor } from "@keychord/chordtest/macos";
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
await assert.rejects(handler("999999"), /does not exist/);
await handler("1");
await waitFor(async () => ((await state()).frontmostAppId === appId ? true : undefined));
for (const target of ["PREVIOUS", "NEXT", "1"]) {
  await handler(target);
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
console.log("monitor-macos-focus-ok: activation, pointer, bounds, queue recovery");
