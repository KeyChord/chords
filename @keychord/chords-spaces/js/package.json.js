//#region package.json
var name = "@keychord/chords-spaces";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-spaces",
};
var type = "module";
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  "macos.toml": {
    name: "macOS Spaces",
    chords: {
      "?/s": { name: "Spaces" },
      "/s[": {
        name: "Space: Previous",
        shortcut: "ctrl+left",
      },
      "/s]": {
        name: "Space: Next",
        shortcut: "ctrl+right",
      },
      "/sl": {
        name: "Space: Left",
        shortcut: "ctrl+left",
      },
      "/sr": {
        name: "Space: Right",
        shortcut: "ctrl+right",
      },
      "/s1": {
        name: "Space: Desktop 1",
        shortcut: "ctrl+1",
      },
      "/s2": {
        name: "Space: Desktop 2",
        shortcut: "ctrl+2",
      },
      "/s3": {
        name: "Space: Desktop 3",
        shortcut: "ctrl+3",
      },
      "/s4": {
        name: "Space: Desktop 4",
        shortcut: "ctrl+4",
      },
      "/s5": {
        name: "Space: Desktop 5",
        shortcut: "ctrl+5",
      },
      "/s6": {
        name: "Space: Desktop 6",
        shortcut: "ctrl+6",
      },
      "/s7": {
        name: "Space: Desktop 7",
        shortcut: "ctrl+7",
      },
      "/s8": {
        name: "Space: Desktop 8",
        shortcut: "ctrl+8",
      },
      "/s9": {
        name: "Space: Desktop 9",
        shortcut: "ctrl+9",
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
