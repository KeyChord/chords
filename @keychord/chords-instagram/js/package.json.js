//#region package.json
var name = "@keychord/chords-instagram";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-instagram",
};
var type = "module";
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "^1.4.3",
  "@types/node": "26.6.5",
  "happy-dom": "^21.0.1",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  com: {
    brave: {
      Browser: {
        app: {
          akpamiohjfcnimfljfndmaldlcfphjmp: {
            "macos.toml": {
              name: "Instagram",
              on: { instagram: { file: "instagram.js" } },
              chords: {
                "?g": { name: "Goto" },
                gh: {
                  name: "Goto: Home",
                  "@input:instagram": ["HOME"],
                },
                gr: {
                  name: "Goto: Reels",
                  "@input:instagram": ["REELS"],
                },
                gm: {
                  name: "Goto: Messages",
                  "@input:instagram": ["MESSAGES"],
                },
                gs: {
                  name: "Goto: Search",
                  "@input:instagram": ["SEARCH"],
                },
                gc: {
                  name: "Goto: Create",
                  "@input:instagram": ["CREATE"],
                },
                gp: {
                  name: "Goto: Profile",
                  "@input:instagram": ["PROFILE"],
                },
                "?h": { name: "Home" },
                "?hs": { name: "Home: Stories" },
                "?hs.": { name: "Home: Stories > Click" },
                "hs.(\\d+)": {
                  name: "Home: Stories > Click @ #",
                  "@input:instagram": ["STORY", "$1"],
                },
                "?hsr": { name: "Home: Stories > Reply" },
                "hsr(\\d+)": {
                  name: "Home: Stories > Reply @ #",
                  "@input:instagram": ["STORY_REPLY", "$1"],
                },
                "?p": { name: "Profile" },
                "?pa": { name: "Profile: Avatar" },
                "pa.": {
                  name: "Profile: Avatar > Click",
                  "@input:instagram": ["AVATAR"],
                },
                "?pan": { name: "Profile: Avatar > Note" },
                pan: {
                  name: "Profile: Avatar > Note",
                  "@input:instagram": ["NOTE"],
                },
                panx: {
                  name: "Profile: Avatar > Note > Close",
                  "@input:instagram": ["CLOSE_NOTE"],
                },
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
