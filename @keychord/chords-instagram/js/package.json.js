//#region package.json
var name = "@keychord/chords-instagram";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-instagram",
};
var type = "module";
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "^1.4.2",
  "@types/node": "26.5.0",
  "happy-dom": "^21.0.1",
};
var packageManager = "pnpm@12.11.2";
var package_default = {
  name,
  repository,
  type,
  devDependencies,
  packageManager,
};
//#endregion
export { package_default as default, devDependencies, name, packageManager, repository, type };
