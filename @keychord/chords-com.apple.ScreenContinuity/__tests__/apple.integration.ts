import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import buildScreenContinuityHandler from "../js/screen-continuity.js";
import { runSafariJavaScript } from "@keychord/chords-com.apple.Safari/safari";

requireMacOSVM();
// Virtual machines cannot connect a mirrored phone. Exercise the real geometry
// addon and its unavailable-app error without replacing its exports.
assert.throws(() => runSafariJavaScript(""), /expected JavaScript source/);
const tap = buildScreenContinuityHandler();
// Exercise repeated MainActor completions after Safari's separate Node-API
// environment has disabled NodeSwift's single-environment fallback queue.
for (let round = 0; round < 100; round++) {
  await assert.rejects(tap("=20bi"), /iPhone Mirroring/);
}
console.log("apple-native-validation-ok");
