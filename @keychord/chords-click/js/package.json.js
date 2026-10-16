//#region package.json
var name = "@keychord/chords-click";
var version = "0.0.0";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-click",
};
var type = "module";
var exports = {
  ".": "./src/js/click.ts",
  "./sequence": "./src/js/utils/click-sequence.ts",
};
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "latest",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  "macos.toml": {
    name: "Mouse",
    on: { click: { file: "click.js" } },
    chords: {
      "?.": { name: "Click" },
      "?..": { name: "Double Click" },
      "?.,": { name: "Right Click" },
      "?.;": { name: "Middle Click" },
      "?.-": { name: "Drag" },
      "?.,-": { name: "Right Drag" },
      "?.;-": { name: "Middle Drag" },
      "?.=": { name: "Move Mouse" },
      "?./": { name: "Global Mouse" },
      ".([.,;=/0-9-].*)": {
        name: "Mouse",
        "@input:click": ["$1", "COMMAND"],
      },
    },
  },
};
var package_default = {
  name,
  version,
  repository,
  type,
  exports,
  devDependencies,
  packageManager,
  chords,
};
//#endregion
export {
  chords,
  package_default as default,
  devDependencies,
  exports,
  name,
  packageManager,
  repository,
  type,
  version,
};
