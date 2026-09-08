//#region package.json
var name = "@keychord/chords-menu";
var version = "0.0.2";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-menu",
};
var type = "module";
var imports = { "#/*": "./src/js/*" };
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
  imports,
  devDependencies,
  packageManager,
};
//#endregion
export {
  package_default as default,
  devDependencies,
  imports,
  name,
  packageManager,
  repository,
  type,
  version,
};
