//#region package.json
var name = "@keychord/chords-modifiers";
var version = "0.0.0";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-modifiers",
};
var type = "module";
var exports = { ".": "./src/js/keys.ts" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "latest",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  "macos.toml": {
    name: "Modifier Keys",
    on: { keys: { file: "keys.js" } },
    chords: {
      "?.": { name: "Click / Modifiers" },
      "?.m": { name: "Meta (Command)" },
      ".(m.[acfms]*)": {
        name: "Meta (Cmd) Combo",
        "@input:keys": ["$1"],
      },
      "?.c": { name: "Control" },
      ".(c.[acfms]*)": {
        name: "Control Combo",
        "@input:keys": ["$1"],
      },
      "?.a": { name: "Alt (Option)" },
      ".(a.[acfms]*)": {
        name: "Alt Combo",
        "@input:keys": ["$1"],
      },
      "?.f": { name: "Fn" },
      ".(f.[acfms]*)": {
        name: "Fn Combo",
        "@input:keys": ["$1"],
      },
      "?.s": { name: "Shift" },
      ".(s.[acfms]*)": {
        name: "Shift Combo",
        "@input:keys": ["$1"],
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
