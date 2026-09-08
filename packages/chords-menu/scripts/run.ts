// Manual check outside Chord: `chord bun scripts/run.ts by-letters f` (the `chord` CLI from a
// Chord build runs the file on the same embedded Bun and provides the `chord` module).
import buildMenuHandler from "../src/js/menu.ts";

const [action = "by-index", value = "1"] = process.argv.slice(2);
const menu = buildMenuHandler();
if (action === "by-index") {
  await menu(action, value);
} else if (action === "by-letters") {
  await menu(action, value);
} else {
  throw new Error(`unknown menu action "${action}"`);
}
console.log("ok");
