// Manual check outside Chord: `chord run scripts/run.ts by-letters f` (the `chord` CLI from a
// Chord build runs the file on the same embedded Bun and provides the `chord` module).
import buildMenuHandler from "../src/js/menu.ts";

const [action = "by-index", value = "1"] = process.argv.slice(2);
buildMenuHandler()(action as "by-index" | "by-letters", value);
console.log("ok");
