//#region package.json
var name = "@keychord/chords-spaces";
var version = "0.0.1";
var displayName = "Spaces Chords";
var description = "Switch between macOS Spaces by direction or desktop number.";
var categories = ["Window Management"];
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-spaces",
};
var type = "module";
var scripts = { test: "bun test --isolate" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@types/bun": "^1.4.3",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  "macos.toml": {
    name: "macOS Spaces",
    meta: { chord: ">=0.3.0" },
    placeholders: {
      "<>": {
        name: "Space prefix",
        default: "s",
      },
    },
    chords: {
      "?<>": { name: "Spaces" },
      "<>[": {
        name: "Space: Previous",
        shortcut: "ctrl+left",
      },
      "<>]": {
        name: "Space: Next",
        shortcut: "ctrl+right",
      },
      "<>l": {
        name: "Space: Left",
        shortcut: "ctrl+left",
      },
      "<>r": {
        name: "Space: Right",
        shortcut: "ctrl+right",
      },
      "<>1": {
        name: "Space: Desktop 1",
        shortcut: "ctrl+1",
      },
      "<>2": {
        name: "Space: Desktop 2",
        shortcut: "ctrl+2",
      },
      "<>3": {
        name: "Space: Desktop 3",
        shortcut: "ctrl+3",
      },
      "<>4": {
        name: "Space: Desktop 4",
        shortcut: "ctrl+4",
      },
      "<>5": {
        name: "Space: Desktop 5",
        shortcut: "ctrl+5",
      },
      "<>6": {
        name: "Space: Desktop 6",
        shortcut: "ctrl+6",
      },
      "<>7": {
        name: "Space: Desktop 7",
        shortcut: "ctrl+7",
      },
      "<>8": {
        name: "Space: Desktop 8",
        shortcut: "ctrl+8",
      },
      "<>9": {
        name: "Space: Desktop 9",
        shortcut: "ctrl+9",
      },
    },
  },
};
var package_default = {
  name,
  version,
  displayName,
  description,
  categories,
  repository,
  type,
  scripts,
  devDependencies,
  packageManager,
  chords,
};
//#endregion
export {
  categories,
  chords,
  package_default as default,
  description,
  devDependencies,
  displayName,
  name,
  packageManager,
  repository,
  scripts,
  type,
  version,
};
