import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { runWebJavaScript } from "../js/web.js";

requireMacOSVM();
assert.throws(() => runWebJavaScript(""), /expected JavaScript source/);
console.log("web-native-validation-ok");
