// Manual check outside Chord: `chord bun scripts/run.ts BY_LETTERS f` (the `chord` CLI from a
// Chord build runs the file on the same embedded Bun and provides the `chord` module).
import buildMenuHandler from "../src/js/menu.ts";

const [action = "BY_INDEX", value = "1"] = process.argv.slice(2);
const menu = buildMenuHandler();
if (action === "BY_INDEX") {
  await menu(action, value);
} else if (action === "BY_LETTERS" || action === "SEARCH") {
  await menu(action, value);
} else {
  throw new Error(`unknown menu action "${action}"`);
}
console.log("ok");
