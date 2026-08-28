//#region package.json
var name = "@keychord/chords-tray";
var version = "0.0.0";
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
  type,
  devDependencies,
  packageManager,
};
//#endregion
export { package_default as default, devDependencies, name, packageManager, type, version };
