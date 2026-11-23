import assert from "node:assert/strict";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import buildSpotlight from "../js/spotlight.js";

requireMacOSVM();
const spotlight = buildSpotlight();
await assert.rejects(spotlight(""), /needs macOS 27 or later/);
await assert.rejects(spotlight("calculator"), /needs macOS 27 or later/);
console.log("spotlight-unavailable-ok");
