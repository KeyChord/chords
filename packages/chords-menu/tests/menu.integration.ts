import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import buildMenuHandler, { runMenuAction } from "../src/js/menu.ts";

const output = process.env.MENU_FIXTURE_OUTPUT!;
const appId = "dev.keychord.menu-fixture";
const menu = buildMenuHandler(appId);
async function recorded(expected: string) {
  for (let i = 0; i < 100; i++) {
    if ((await readFile(output, "utf8")) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(await readFile(output, "utf8"), expected);
}

await menu("by-index", 2);
await recorded("opened:File");
await menu("by-letters", "z-o2");
await recorded("Zoom Original");
await menu("by-letters", "ff");
await recorded("opened:Format");
await menu("by-letters", "f");
await recorded("opened:File");
await menu("by-letters", "zo2");
await recorded("Zoom Original");
await menu("by-path", ["File", "Submenu", "Zoom Outer"]);
await recorded("Zoom Outer");
await menu("by-path", ["File", "Clean Title"]);
await recorded("\u200BClean Title");
await assert.rejects(menu("by-path", ["File", "Disabled"]), /disabled/);
await assert.rejects(menu("by-path", ["File", "Missing"]), /has no component/);
await assert.rejects(menu("by-index", 999), /out of range/);
await assert.rejects(menu("by-letters", ""), /non-empty lowercase query/);
await assert.rejects(runMenuAction(appId, "by-path", [] as any), /at least two/);
// Check captured app context is preserved across the Promise bridge.
await buildMenuHandler().call({ focusedAppId: appId }, "by-path", ["Format", "Fixture Action"]);
await recorded("Fixture Action");
console.log("menu integration passed");
