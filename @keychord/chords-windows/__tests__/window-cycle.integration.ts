import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { waitFor } from "@keychord/chordtest/macos";
import buildWindowHandler from "../js/window.js";

requireMacOSVM();
const [appId, output, coverId] = process.argv.slice(2);
type State = {
  keyWindow: string;
  frontmostAppId: string;
  keyEvents: number;
  windows: { title: string; visible: boolean; minimized: boolean }[];
};
const state = (): Promise<State> => Bun.file(output).json();
await waitFor(async () => ((await state()).frontmostAppId === coverId ? true : undefined));
const handler = buildWindowHandler();
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as any;
async function step(input: "/w[" | "/w]") {
  const before = (await state()).keyWindow;
  const args = definition.chords[input]["@input:window"];
  await handler.call({ focusedAppId: appId, input }, args[0], args[1]);
  const result = await waitFor(async () => {
    const current = await state();
    return current.frontmostAppId === appId && current.keyWindow !== before ? current : undefined;
  });
  assert.ok(["One", "Two", "Three", "Four"].includes(result.keyWindow));
  assert.equal(result.keyEvents, 0);
  assert.equal(result.windows.find((window) => window.title === "Minimized")?.minimized, true);
  return result.keyWindow;
}
// The captured app is behind another app, with all three windows overlapping.
const forward = [await step("/w]"), await step("/w]"), await step("/w]")];
assert.equal(new Set(forward).size, 3);
assert.equal(await step("/w]"), forward[0]);
assert.equal(await step("/w["), forward[2]);
assert.equal(await step("/w["), forward[1]);
assert.equal(await step("/w["), forward[0]);
await Bun.write(output + ".command", "close:" + forward[1]);
await waitFor(async () =>
  (await state()).windows.find((window) => window.title === forward[1])?.visible === false
    ? true
    : undefined,
);
assert.equal(await step("/w]"), forward[2]);
assert.equal(await step("/w]"), forward[0]);
await Bun.write(output + ".command", "add:Four");
await waitFor(async () => ((await state()).keyWindow === "Four" ? true : undefined));
const updated = [await step("/w]"), await step("/w]"), await step("/w]")];
assert.deepEqual(new Set(updated), new Set([forward[0], forward[2], "Four"]));
await Bun.write(output + ".command", "minimize:" + forward[2]);
await waitFor(async () =>
  (await state()).windows.find((window) => window.title === forward[2])?.minimized
    ? true
    : undefined,
);
const remaining = [await step("/w]"), await step("/w]")];
assert.deepEqual(new Set(remaining), new Set([forward[0], "Four"]));
await Bun.write(output + ".command", "close:" + forward[0]);
await waitFor(async () => {
  const current = await state();
  return current.keyWindow === "Four" &&
    current.windows.find((window) => window.title === forward[0])?.visible === false
    ? true
    : undefined;
});
await handler.call({ focusedAppId: appId }, "CYCLE", "NEXT");
assert.equal((await state()).keyWindow, "Four");
await assert.rejects(
  handler.call({ focusedAppId: "dev.keychord.nonexistent" }, "CYCLE", "NEXT"),
  /not running/,
);
await handler.call({ focusedAppId: appId }, "CYCLE", "PREVIOUS");
console.log(
  "window-cycle-ok: captured app, three windows, both directions, wraparound, close, add, minimize, single window, no key events",
);
