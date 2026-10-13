//#region package.json
var name = "@keychord/chords-spotify";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-spotify",
};
var type = "module";
var devDependencies = {
  "@chord/com.npmjs.types__node": "workspace:*",
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "^1.4.0",
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
