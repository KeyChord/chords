//#region package.json
var name = "@keychord/chords-youtube";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-youtube",
};
var type = "module";
var devDependencies = {
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "happy-dom": "^21.0.1",
};
var package_default = {
  name,
  repository,
  type,
  devDependencies,
};
//#endregion
export { package_default as default, devDependencies, name, repository, type };
