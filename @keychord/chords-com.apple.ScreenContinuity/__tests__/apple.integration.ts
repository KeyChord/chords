import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { chordPattern } from "@keychord/chordtest/patterns";
import buildScreenContinuityHandler from "../js/screen-continuity.js";
import { runSafariJavaScript } from "@keychord/chords-com.apple.Safari/safari";

requireMacOSVM();
// Virtual machines cannot connect a mirrored phone. Exercise the real geometry
// addon and its unavailable-app error without replacing its exports.
assert.throws(() => runSafariJavaScript(""), /expected JavaScript source/);
const definition = Bun.TOML.parse(
  await Bun.file(
    new URL("../chords/com/apple/ScreenContinuity/macos.toml", import.meta.url),
  ).text(),
) as { chords: Record<string, Record<string, string[]>> };
const handlers = {
  "@input:tap": buildScreenContinuityHandler(),
  "@input:hover": buildScreenContinuityHandler("HOVER"),
};
for (const [sequence, event] of [
  ["t55", "@input:tap"],
  ["h55", "@input:hover"],
] as const) {
  const matches = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
    const capture = chordPattern(pattern).exec(sequence);
    return capture && binding[event] ? [binding[event][0].replace("$1", capture[1])] : [];
  });
  assert.equal(matches.length, 1, sequence);
  await assert.rejects(handlers[event](matches[0]), /iPhone Mirroring/);
}
// Exercise repeated MainActor completions after Safari's separate Node-API
// environment has disabled NodeSwift's single-environment fallback queue.
for (let round = 0; round < 100; round++) {
  await assert.rejects(handlers["@input:tap"]("=20bi"), /iPhone Mirroring/);
}
console.log("apple-native-validation-ok");
