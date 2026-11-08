//#region package.json
var name = "@keychord/chords-chord";
var displayName = "Chord Controls";
var description = "Chord's own controls in the 0 namespace, always loaded by Chord.";
var categories = ["Chord"];
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-chord",
};
var type = "module";
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  com: {
    leonsilicon: {
      chord: {
        "macos.toml": {
          name: "Chords",
          chords: {
            '?"1-9"': { name: "Repeat count" },
            "?/": { name: "Launch" },
            "?0": { name: "Chord" },
            "0,": {
              name: "Chord: Settings",
              builtin: { command: "settings" },
            },
            "0,r": {
              name: "Chord: Settings > Reload",
              builtin: { command: "reload" },
            },
            "0q": {
              name: "Chord: Quit",
              builtin: { command: "quit" },
            },
            "?0l": { name: "Chord: Layout" },
            "0ls": {
              name: "Layout: Sidebar left",
              builtin: {
                command: "set-layout",
                argument: "sidebar-left",
              },
            },
            "0lsl": {
              name: "Layout: Sidebar left",
              builtin: {
                command: "set-layout",
                argument: "sidebar-left",
              },
            },
            "0lf": {
              name: "Layout: Floating bottom",
              builtin: {
                command: "set-layout",
                argument: "floating-bottom",
              },
            },
            "0lfb": {
              name: "Layout: Floating bottom",
              builtin: {
                command: "set-layout",
                argument: "floating-bottom",
              },
            },
            "0lv": {
              name: "Layout: Cycle",
              builtin: { command: "cycle-layout" },
            },
            "?0h": { name: "Chord: Halt (Loop)" },
            "0h(\\d+)": {
              name: "Halt loop #$1",
              builtin: {
                command: "halt-loop",
                argument: "$1",
              },
            },
            "?0b": { name: "Chord: Save temporary buffer (1–9)" },
            "0b([1-9].*)": {
              name: "Save temporary buffer",
              builtin: {
                command: "set-buffer",
                argument: "$1",
              },
            },
            "?0=": { name: "Chord: Save named macro" },
            "0=([^=]+=.*)": {
              name: "Save named macro",
              builtin: {
                command: "set-macro",
                argument: "$1",
              },
            },
          },
        },
      },
    },
  },
};
var package_default = {
  name,
  displayName,
  description,
  categories,
  repository,
  type,
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
  type,
};
