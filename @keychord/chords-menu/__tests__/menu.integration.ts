import assert from "node:assert/strict";
import builtMenuHandler, { runMenuAction } from "../js/menu.js";

// Exercise the production bundle with the source API's overloads.
const buildMenuHandler = builtMenuHandler as typeof import("../src/js/menu").default;

const output = process.env.MENU_FIXTURE_OUTPUT!;
const appId = "dev.keychord.menu-fixture";
const menu = buildMenuHandler(appId);
async function recorded(expected: string) {
  for (let i = 0; i < 100; i++) {
    if ((await Bun.file(output).text()) === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(await Bun.file(output).text(), expected);
}

// The chord passes a string, like the captured indices for -1 through -9.
await menu("BY_INDEX", "0");
await assert.rejects(menu("BY_LETTERS", "zz9"), /No expanded menu item match/);
await menu("BY_LETTERS", "a");
await recorded("opened:Arrange");
await menu("BY_LETTERS", "aa");
await recorded("opened:Apple Tools");
await assert.rejects(menu("BY_LETTERS", "aaa"), /Found 2/);
await menu("BY_INDEX", 0);
await assert.rejects(menu("BY_LETTERS", "zz9"), /No expanded menu item match/);
await menu("BY_INDEX", 2);
await recorded("opened:File");
await menu("BY_LETTERS", "z-o2");
await recorded("Zoom Original");
await menu("BY_LETTERS", "ff");
await recorded("opened:Format");
await menu("BY_LETTERS", "f");
await recorded("opened:File");
await menu("BY_LETTERS", "zo2");
await recorded("Zoom Original");
await menu("BY_PATH", ["File", "Submenu", "Zoom Outer"]);
await recorded("Zoom Outer");
await menu("BY_PATH", ["File", "Clean Title"]);
await recorded("\u200BClean Title");
await assert.rejects(menu("BY_PATH", ["File", "Disabled"]), /disabled/);
await assert.rejects(menu("BY_PATH", ["File", "Missing"]), /has no component/);
await assert.rejects(menu("BY_INDEX", 999), /out of range/);
await assert.rejects(menu("BY_LETTERS", ""), /non-empty lowercase query/);
await assert.rejects(runMenuAction(appId, "BY_PATH", [] as any), /at least one/);
// Check captured app context is preserved across the Promise bridge.
await buildMenuHandler().call({ focusedAppId: appId }, "BY_PATH", ["Format", "Fixture Action"]);
await recorded("Fixture Action");
await assert.rejects(menu("SEARCH", "fixture action"), /ambiguous.*Format > Fixture Action/s);
await menu("SEARCH", "Format > Fixture Action");
await recorded("Fixture Action");
await menu("SEARCH", "File > Submenu > Zoom Outer");
await recorded("Zoom Outer");
await menu("SEARCH", "100% … 日本語");
await recorded("100% … 日本語");
await assert.rejects(menu("SEARCH", "There is no such menu item 123!?"), /No menu item/);
await assert.rejects(menu("SEARCH", "Disabled"), /disabled/);
console.log("menu integration passed");
