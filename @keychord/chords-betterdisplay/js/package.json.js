//#region package.json
var name = "@keychord/chords-betterdisplay";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-betterdisplay",
};
var type = "module";
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "latest",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  "macos.toml": {
    name: "BetterDisplay",
    on: { monitor: { file: "monitor.js" } },
    chords: {
      "?/ms": { name: "Monitor: Size" },
      "/ms(.+)": {
        name: "Monitor: Size (Set)",
        "@input:monitor": ["$1"],
      },
    },
  },
};
var package_default = {
  name,
  repository,
  type,
  devDependencies,
  packageManager,
  chords,
};
//#endregion
export {
  chords,
  package_default as default,
  devDependencies,
  name,
  packageManager,
  repository,
  type,
};
