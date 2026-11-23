//#region package.json
var name = "@keychord/chords-youtube";
var displayName = "YouTube Chords";
var version = "0.0.1";
var description = "Chords for YouTube in a Chromium browser or Brave web app.";
var categories = ["Media"];
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-youtube",
};
var type = "module";
var scripts = { test: "bun test --isolate" };
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "^1.4.3",
  "happy-dom": "^21.0.1",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  com: {
    brave: {
      Browser: {
        app: {
          agimnkijcaahngcdmfeangaknmldooml: {
            "macos.toml": {
              name: "YouTube",
              on: { youtube: { file: "youtube.js" } },
              chords: {
                "?v": { name: "Video" },
                "?vs": { name: "Video: Scrub" },
                "vs(\\d+)": {
                  name: "Video: Scrub (to second)",
                  "@input:youtube": ["SEEK", "$1"],
                },
                vp: {
                  name: "Video: Play",
                  "@input:youtube": ["PLAY"],
                },
                vh: {
                  name: "Video: Halt",
                  "@input:youtube": ["PAUSE"],
                },
                vm: {
                  name: "Video: Mute",
                  "@input:youtube": ["MUTE"],
                },
                va: {
                  name: "Video: Autoplay",
                  "@input:youtube": ["AUTOPLAY"],
                },
                vc: {
                  name: "Video: Closed Captions",
                  "@input:youtube": ["CAPTIONS"],
                },
                "v,": {
                  name: "Video: Settings",
                  "@input:youtube": ["SETTINGS"],
                },
                vt: {
                  name: "Video: Theater Mode",
                  "@input:youtube": ["THEATER"],
                },
                vf: {
                  name: "Video: Fullscreen",
                  "@input:youtube": ["FULLSCREEN"],
                },
                js: {
                  name: "Search",
                  "@input:youtube": ["SEARCH"],
                },
              },
            },
          },
        },
      },
    },
  },
  "linux.toml": {
    name: "YouTube",
    meta: { chord: ">=0.3.4" },
    on: {
      youtube: {
        file: "youtube.js",
        args: [9222, true],
      },
    },
    placeholders: {
      "<>": {
        name: "YouTube prefix",
        default: "y",
      },
    },
    chords: {
      "?<>": { name: "YouTube" },
      "?<>v": { name: "Video" },
      "?<>vs": { name: "Video: Scrub" },
      "<>vs(\\d+)": {
        name: "Video: Scrub (to second)",
        "@input:youtube": ["SEEK", "$1"],
      },
      "<>vp": {
        name: "Video: Play",
        "@input:youtube": ["PLAY"],
      },
      "<>vh": {
        name: "Video: Halt",
        "@input:youtube": ["PAUSE"],
      },
      "<>vm": {
        name: "Video: Mute",
        "@input:youtube": ["MUTE"],
      },
      "<>va": {
        name: "Video: Autoplay",
        "@input:youtube": ["AUTOPLAY"],
      },
      "<>vc": {
        name: "Video: Closed Captions",
        "@input:youtube": ["CAPTIONS"],
      },
      "<>v,": {
        name: "Video: Settings",
        "@input:youtube": ["SETTINGS"],
      },
      "<>vt": {
        name: "Video: Theater Mode",
        "@input:youtube": ["THEATER"],
      },
      "<>vf": {
        name: "Video: Fullscreen",
        "@input:youtube": ["FULLSCREEN"],
      },
      "<>js": {
        name: "Search",
        "@input:youtube": ["SEARCH"],
      },
    },
  },
  "windows.toml": {
    name: "YouTube",
    meta: { chord: ">=0.3.4" },
    on: {
      youtube: {
        file: "youtube.js",
        args: [9222, true],
      },
    },
    placeholders: {
      "<>": {
        name: "YouTube prefix",
        default: "y",
      },
    },
    chords: {
      "?<>": { name: "YouTube" },
      "?<>v": { name: "Video" },
      "?<>vs": { name: "Video: Scrub" },
      "<>vs(\\d+)": {
        name: "Video: Scrub (to second)",
        "@input:youtube": ["SEEK", "$1"],
      },
      "<>vp": {
        name: "Video: Play",
        "@input:youtube": ["PLAY"],
      },
      "<>vh": {
        name: "Video: Halt",
        "@input:youtube": ["PAUSE"],
      },
      "<>vm": {
        name: "Video: Mute",
        "@input:youtube": ["MUTE"],
      },
      "<>va": {
        name: "Video: Autoplay",
        "@input:youtube": ["AUTOPLAY"],
      },
      "<>vc": {
        name: "Video: Closed Captions",
        "@input:youtube": ["CAPTIONS"],
      },
      "<>v,": {
        name: "Video: Settings",
        "@input:youtube": ["SETTINGS"],
      },
      "<>vt": {
        name: "Video: Theater Mode",
        "@input:youtube": ["THEATER"],
      },
      "<>vf": {
        name: "Video: Fullscreen",
        "@input:youtube": ["FULLSCREEN"],
      },
      "<>js": {
        name: "Search",
        "@input:youtube": ["SEARCH"],
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
