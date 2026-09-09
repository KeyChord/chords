//#region package.json
var name = "@keychord/chords-tray";
var version = "0.0.0";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-tray",
};
var type = "module";
var devDependencies = {
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "latest",
};
var packageManager = "pnpm@10.33.0";
var package_default = {
  name,
  version,
  repository,
  type,
  devDependencies,
  packageManager,
};
//#endregion
export {
  package_default as default,
  devDependencies,
  name,
  packageManager,
  repository,
  type,
  version,
};
