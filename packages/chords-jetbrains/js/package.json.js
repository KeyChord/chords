//#region package.json
var name = "@keychord/chords-jetbrains";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-jetbrains",
};
var type = "module";
var dependencies = {
  "nano-spawn-compat": "latest",
  outdent: "latest",
};
var devDependencies = {
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "^1.4.2",
};
var packageManager = "pnpm@10.33.0";
var package_default = {
  name,
  repository,
  type,
  dependencies,
  devDependencies,
  packageManager,
};
//#endregion
export {
  package_default as default,
  dependencies,
  devDependencies,
  name,
  packageManager,
  repository,
  type,
};
