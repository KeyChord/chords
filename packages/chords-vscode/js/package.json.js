//#region package.json
var name = "@keychord/chords-vscode";
var version = "0.0.0";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-vscode",
};
var type = "module";
var dependencies = { "nano-spawn-compat": "latest" };
var devDependencies = {
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
};
var packageManager = "pnpm@10.33.0";
var package_default = {
  name,
  version,
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
  version,
};
