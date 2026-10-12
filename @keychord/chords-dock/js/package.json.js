//#region package.json
var name = "@keychord/chords-dock";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-dock",
};
var type = "module";
var devDependencies = {
  "@keychord/chords-menu": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
};
var packageManager = "pnpm@10.33.0";
var package_default = {
  name,
  repository,
  type,
  devDependencies,
  packageManager,
};
//#endregion
export { package_default as default, devDependencies, name, packageManager, repository, type };
