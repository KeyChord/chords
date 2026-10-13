// Executed by `chord bun` in the guest, with real builtin exports and native addons.
import { click, getAppWindows } from "chord";
import { join } from "node:path";
import { requireMacOSVM } from "./runtime";
import { hostTriple } from "./native";

requireMacOSVM();
const root = process.argv[2];
if (!root) throw new Error("A package root is required");
const manifest = await Bun.file(join(root, "package.json")).json();
if (!manifest.name?.startsWith("@keychord/")) throw new Error("Invalid chord package manifest");
if (typeof click !== "function" || typeof getAppWindows !== "function")
  throw new Error("Native Chord input exports are missing");
if (getAppWindows("dev.keychord.chordtest.nonexistent").length)
  throw new Error("Unexpected fixture app");

const definitions = [...new Bun.Glob("chords/**/*.toml").scanSync({ cwd: root })];
if (await Bun.file(join(root, "chordpack.toml")).exists()) definitions.push("chordpack.toml");
if (!definitions.length && manifest.name !== "@keychord/chordtest")
  throw new Error("Package has no chord definitions");
for (const path of definitions) {
  const definition = Bun.TOML.parse(await Bun.file(join(root, path)).text()) as Record<string, any>;
  if (typeof definition.name !== "string" || !definition.name.trim())
    throw new Error(`${path}: missing name`);
  for (const handler of Object.values(definition.on ?? {}) as { file?: string }[]) {
    if (!handler.file) throw new Error(`${path}: missing handler file`);
    const vendor = path.match(/^chords\/(@[^/]+\/[^/]+)\/chords\//)?.[1];
    const module =
      vendor && !handler.file.startsWith("@")
        ? join(root, "js", vendor, "js", handler.file)
        : join(root, "js", handler.file);
    if (!(await Bun.file(module).exists()))
      throw new Error(`${path}: missing handler ${handler.file}`);
    const exports = await import(Bun.pathToFileURL(module).href);
    if (typeof exports.default !== "function") throw new Error(`${path}: handler has no builder`);
  }
}
// Loading production bundles catches platform imports and missing host exports without
// launching users' apps or invoking builders that require third-party services.
for (const path of new Bun.Glob("js/*.js").scanSync({ cwd: root })) {
  await import(Bun.pathToFileURL(join(root, path)).href);
}
const packagedAddons = [
  ...new Bun.Glob(`js/native/${hostTriple}/**/*.node`).scanSync({ cwd: root }),
];
const nativeAddons = packagedAddons.length
  ? packagedAddons
  : [...new Bun.Glob(`target/${hostTriple}/*/*.node`).scanSync({ cwd: root })];
for (const path of nativeAddons) {
  // The plugin's loaders already require these files. Share Bun's cache so validating
  // exports doesn't register the same Swift classes from a second copy under target/.
  const exports = require(join(root, path));
  if (!Object.keys(exports).length) throw new Error(`${path}: addon has no exports`);
}
console.log(`package-macos-ok ${manifest.name} (${definitions.length} definitions)`);
