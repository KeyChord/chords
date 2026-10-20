//#region package.json
var name = "@keychord/chords-terminal";
var displayName = "Terminal Chords";
var version = "0.0.0";
var description =
  "Tab chords for basic terminals: Terminal, iTerm2, Ghostty, WezTerm, Alacritty and Hyper.";
var categories = ["Terminals"];
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-terminal",
};
var type = "module";
var scripts = { test: "bun test --isolate" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  "base.toml": {
    name: "Terminal Tabs",
    chords: {
      "?t": { name: "Tab" },
      t1: {
        name: "Tab 1",
        shortcut: "cmd+1",
      },
      t2: {
        name: "Tab 2",
        shortcut: "cmd+2",
      },
      t3: {
        name: "Tab 3",
        shortcut: "cmd+3",
      },
      t4: {
        name: "Tab 4",
        shortcut: "cmd+4",
      },
      t5: {
        name: "Tab 5",
        shortcut: "cmd+5",
      },
      t6: {
        name: "Tab 6",
        shortcut: "cmd+6",
      },
      t7: {
        name: "Tab 7",
        shortcut: "cmd+7",
      },
      t8: {
        name: "Tab 8",
        shortcut: "cmd+8",
      },
    },
  },
  co: {
    zeit: {
      hyper: {
        "macos.toml": {
          name: "Hyper",
          import: [{ file: "base.toml" }],
        },
      },
    },
  },
  com: {
    apple: {
      Terminal: {
        "macos.toml": {
          name: "Terminal",
          import: [{ file: "base.toml" }],
          chords: {
            t9: {
              name: "Tab 9",
              shortcut: "cmd+9",
            },
          },
        },
      },
    },
    github: {
      wez: {
        wezterm: {
          "macos.toml": {
            name: "WezTerm",
            import: [{ file: "base.toml" }],
          },
        },
      },
    },
    googlecode: {
      iterm2: {
        "macos.toml": {
          name: "iTerm2",
          import: [{ file: "base.toml" }],
        },
      },
    },
    mitchellh: {
      ghostty: {
        "macos.toml": {
          name: "Ghostty",
          import: [{ file: "base.toml" }],
        },
      },
    },
  },
  "macos.toml": {
    name: "Terminal",
    chords: {
      "/t": {
        name: "Terminal",
        shell: "open -a Terminal",
      },
    },
  },
  org: {
    alacritty: {
      "macos.toml": {
        name: "Alacritty",
        import: [{ file: "base.toml" }],
      },
    },
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
