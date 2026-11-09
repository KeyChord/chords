//#region package.json
var name = "@keychord/chords-com.apple.AccessibilityInspector";
var displayName = "Accessibility Inspector Chords";
var version = "0.0.0";
var description = "Chords for Accessibility Inspector (com.apple.AccessibilityInspector).";
var categories = ["macOS"];
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-com.apple.AccessibilityInspector",
};
var type = "module";
var scripts = { test: "bun test --isolate" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  com: {
    apple: {
      AccessibilityInspector: {
        "macos.toml": {
          name: "Accessibility Inspector",
          chords: {
            "?i": { name: "Inspect" },
            ir: {
              name: "Inspect: Refresh",
              shortcut: "cmd+r",
            },
            ip: {
              name: "Inspect: Point",
              shortcut: "cmd+ctrl+alt+shift+p",
            },
            iu: {
              name: "Inspect: Up Hierarchy - Parent",
              shortcut: "cmd+ctrl+up",
            },
            id: {
              name: "Inspect: Down Hierarchy - Child",
              shortcut: "cmd+ctrl+down",
            },
            "i[": {
              name: "Inspect: Previous",
              shortcut: "cmd+ctrl+left",
            },
            "i]": {
              name: "Inspect: Next",
              shortcut: "cmd+ctrl+right",
            },
            "?v": { name: "Vary" },
            va: {
              name: "Vary Auto-Interact",
              shell:
                '  osascript -e \'tell application "System Events" to tell process "Accessibility Inspector" to click (first menu item of menu 1 of menu bar item "Inspection" of menu bar 1 whose name contains "Auto-Interact")\'\n',
            },
            vc: {
              name: "Vary Class",
              shell:
                '  osascript -e \'tell application "System Events" to tell process "Accessibility Inspector" to click (first menu item of menu 1 of menu bar item "Inspection" of menu bar 1 whose name contains "Class Name")\'\n',
            },
            vi: {
              name: "Vary Ignored",
              shell:
                '  osascript -e \'tell application "System Events" to tell process "Accessibility Inspector" to click (first menu item of menu 1 of menu bar item "Inspection" of menu bar 1 whose name contains "Ignored Elements")\'\n',
            },
          },
        },
      },
    },
  },
  "macos.toml": {
    name: "Accessibility Inspector",
    chords: {},
  },
};
var package_default = {
  name,
  displayName,
  version,
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
