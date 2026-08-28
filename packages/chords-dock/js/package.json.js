//#region package.json
var name = "@keychord/chords-dock";
var type = "module";
var devDependencies = {
  "@keychord/chords-menu": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
};
var packageManager = "pnpm@10.33.0";
var package_default = {
  name,
  type,
  devDependencies,
  packageManager,
};
//#endregion
export { package_default as default, devDependencies, name, packageManager, type };
