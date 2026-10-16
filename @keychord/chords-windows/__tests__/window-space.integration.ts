import assert from "node:assert/strict";
import { requireMacOSVM, waitFor } from "@keychord/chordtest";
import { chordPattern } from "@keychord/chordtest/patterns";
import buildWindowHandler from "../js/window.js";

requireMacOSVM();
const [appId, output, coverId] = process.argv.slice(2);
type State = {
  spaces: number[];
  desktops: number[];
  activeSpace: number;
  frontmostAppId: string;
  frame: number[];
  windowId: number;
  companionSpaces: number[];
};
const state = async (): Promise<State> => {
  const result = await Bun.file(output).json();
  assert.equal(result.setupError, undefined, result.setupError);
  return result;
};
await waitFor(async () => ((await state()).frontmostAppId === coverId ? true : undefined));
const original = await state();
const handler = buildWindowHandler();
// Chord selects the fixture's key window when a run starts. Once it leaves the visible
// Space, the application's companion window takes focus and must stay where it is.
const selected = { focusedAppId: appId, focusedWindowId: original.windowId };
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as any;
async function invoke(input: string, index: number) {
  const matches = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
    const capture = chordPattern(pattern).exec(input);
    const args = (binding as any)["@input:window"] as string[] | undefined;
    return capture && args
      ? [args.map((arg) => arg.replace(/\$(\d+)/g, (_, i) => capture[Number(i)]))]
      : [];
  });
  assert.equal(matches.length, 1, input);
  await handler.call({ ...selected, input }, matches[0][0], matches[0][1]);
  await reached(index);
}
async function reached(index: number) {
  const current = await waitFor(async () => {
    const current = await state();
    return current.spaces.length === 1 && current.spaces[0] === original.desktops[index - 1]
      ? current
      : undefined;
  });
  assert.equal(
    current.activeSpace,
    original.activeSpace,
    "moving a window must not switch the visible Space",
  );
  assert.equal(
    current.frontmostAppId,
    coverId,
    "the captured app must be targeted behind the cover",
  );
  assert.deepEqual(current.frame, original.frame, "moving between Spaces preserves geometry");
  assert.deepEqual(
    current.companionSpaces,
    original.companionSpaces,
    "only the selected window moves",
  );
}
const originalIndex = original.desktops.indexOf(original.spaces[0]) + 1;
try {
  await invoke("/ws1", 1);
  await assert.rejects(handler.call(selected, "SPACE", "PREVIOUS"), /no previous/);
  await invoke("/ws2", 2);
  await invoke("/ws]", 3);
  await invoke("/ws[", 2);
  await invoke(`/ws${original.desktops.length}`, original.desktops.length);
  await assert.rejects(handler.call(selected, "SPACE", "NEXT"), /no next/);
  await assert.rejects(handler.call(selected, "SPACE", "9999"), /does not exist/);
  await invoke("/ws1", 1);
  // `2/ws]`: Chord calls the built handler once per repetition with the same window,
  // including after the first move takes it off the visible Space, out of Accessibility.
  for (let repetition = 0; repetition < 2; repetition++)
    await handler.call({ ...selected, input: "/ws]" }, "SPACE", "NEXT");
  await reached(3);
} finally {
  await invoke(`/ws${originalIndex}`, originalIndex);
}
console.log(
  "window-space-ok: numbered, next, previous, boundaries, selected window, repeats, geometry, no Space switch",
);
