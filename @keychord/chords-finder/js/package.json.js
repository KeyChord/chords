//#region package.json
var name = "@keychord/chords-finder";
var version = "0.0.0";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-finder",
};
var type = "module";
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
};
var packageManager = "pnpm@12.11.2";
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
