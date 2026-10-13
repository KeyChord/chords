import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import buildScreenContinuityHandler from "../js/screen-continuity.js";

requireMacOSVM();
// Virtual machines cannot connect a mirrored phone. Exercise the real geometry
// addon and its unavailable-app error without replacing its exports.
await assert.rejects(buildScreenContinuityHandler()("b20l.5"), /iPhone Mirroring/);
const module = { exports: {} as { runJavaScript(source: string): void } };
process.dlopen(module, import.meta.chord.resolveNative("safari"));
assert.throws(() => module.exports.runJavaScript(""), /expected JavaScript source/);
console.log("apple-native-validation-ok");
