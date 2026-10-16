//#region package.json
var name = "@keychord/chords-spotify";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-spotify",
};
var type = "module";
var devDependencies = {
  "@chord/com.npmjs.types__node": "workspace:*",
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "^1.4.3",
  "happy-dom": "^21.0.1",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  com: {
    spotify: {
      client: {
        "macos.toml": {
          name: "Spotify",
          on: { spotify: { file: "spotify.js" } },
          chords: {
            "?g": { name: "Goto" },
            "g/": { name: "Goto: Search" },
            gh: { name: "Goto: Home" },
            gb: { name: "Goto: Browse" },
            gn: { name: "Goto: Notifications (What's New)" },
            gla: { name: "Goto: Listening Activity" },
            gls: {
              name: "Goto: Liked Songs",
              "@input:spotify": ["LIKED_SONGS"],
            },
            gl: { name: "Goto: Library" },
            "gl/": { name: "Goto: Library > Search" },
            glpl: { name: "Goto: Library > Playlists" },
            glpy: { name: "Goto: Library > Playlists (by) You" },
            glps: { name: "Goto: Library > Playlists (by) Spotify" },
            glpo: { name: "Goto: Library > Podcasts" },
            glal: { name: "Goto: Library > Albums" },
            glar: { name: "Goto: Library > Artists" },
            glev: { name: "Goto: Library > Events" },
            gleu: { name: "Goto: Library > Events Upcoming" },
            gc: { name: "Goto: Create" },
            "gl(.+)": { name: "Goto: Library > Item @ #" },
            "g[": { name: "Go: Back" },
            "g]": { name: "Go: Forward" },
            "?l": { name: "Library (Sidebar)" },
            "?p": { name: "Playlist" },
            "p/": { name: "Playlist: Search" },
            "pm(\\d+)": {
              name: "Playlist: More @ #$1",
              "@input:spotify": ["MORE", "$1"],
            },
            "pr(\\d+)": {
              name: "Playlist: Remove @ #$1",
              "@input:spotify": ["REMOVE", "$1"],
            },
            "pa(\\d+)": {
              name: "Playlist: Add (to queue) @ #$1",
              "@input:spotify": ["QUEUE", "$1"],
            },
            "pe(\\d+)": {
              name: "Playlist: Exclude (from taste profile) @ #$1",
              "@input:spotify": ["EXCLUDE", "$1"],
            },
            "?psj": { name: "Playlist: Start Jam" },
            "psj(\\d+)": {
              name: "Playlist: Start Jam @ #$1",
              "@input:spotify": ["JAM", "$1"],
            },
            "?pg": { name: "Playlist: Goto" },
            "pgsr(\\d+)": {
              name: "Playlist: Goto Song Radio @ #$1",
              "@input:spotify": ["SONG_RADIO", "$1"],
            },
            "pgar(\\d+)": {
              name: "Playlist: Goto Artist @ #$1",
              "@input:spotify": ["ARTIST", "$1"],
            },
            "pgal(\\d+)": {
              name: "Playlist: Goto Album @ #$1",
              "@input:spotify": ["ALBUM", "$1"],
            },
            "?pv": { name: "Playlist: View Credits" },
            "pvc(\\d+)": {
              name: "Playlist: View Credits @ #$1",
              "@input:spotify": ["CREDITS", "$1"],
            },
            "?ps": { name: "Playlist: Share" },
            "psc(\\d+)": {
              name: "Playlist: Share > Copy (link to Song) @ #$1",
              "@input:spotify": ["COPY_LINK", "$1"],
            },
            "pse(\\d+)": {
              name: "Playlist: #$1 > Share > Embed (track)",
              "@input:spotify": ["EMBED", "$1"],
            },
            "?b": { name: "Bar (Player)" },
            "b[": {
              name: "Bar: Previous",
              "@input:spotify": ["BAR_PREVIOUS"],
            },
            "b]": {
              name: "Bar: Next",
              "@input:spotify": ["BAR_NEXT"],
            },
            bp: {
              name: "Bar: Play",
              "@input:spotify": ["BAR_PLAY"],
            },
            bh: {
              name: "Bar: Halt",
              "@input:spotify": ["BAR_HALT"],
            },
            br: {
              name: "Bar: Repeat",
              "@input:spotify": ["BAR_REPEAT"],
            },
            bl: {
              name: "Bar: Lyrics",
              "@input:spotify": ["BAR_LYRICS"],
            },
            bq: {
              name: "Bar: Queue",
              "@input:spotify": ["BAR_QUEUE"],
            },
            bc: {
              name: "Bar: Connect (to device)",
              "@input:spotify": ["BAR_CONNECT"],
            },
            bm: {
              name: "Bar: Miniplayer",
              "@input:spotify": ["BAR_MINIPLAYER"],
            },
            bf: {
              name: "Bar: Fullscreen",
              "@input:spotify": ["BAR_FULLSCREEN"],
            },
            "?bs": { name: "Bar: Shuffle / Scrub" },
            bs: {
              name: "Bar: Shuffle",
              "@input:spotify": ["BAR_SHUFFLE"],
            },
            "bs(\\d+)": {
              name: "Bar: Scrub (to second)",
              "@input:spotify": ["BAR_SCRUB", "$1"],
            },
            "?np": { name: "Now Playing" },
            npv: {
              name: "Now Playing: Vary (Toggle Hidden)",
              "@input:spotify": ["NP_TOGGLE"],
            },
            npx: {
              name: "Now Playing: X (Hide)",
              "@input:spotify": ["NP_HIDE"],
            },
            npf: {
              name: "Now Playing: Fullscreen (Expand)",
              "@input:spotify": ["NP_EXPAND"],
            },
            npm: {
              name: "Now Playing: Minimize",
              "@input:spotify": ["NP_MINIMIZE"],
            },
            npa: {
              name: "Now Playing: Artwork (View)",
              "@input:spotify": ["NP_ARTWORK"],
            },
            npc: {
              name: "Now Playing: Canvas (View)",
              "@input:spotify": ["NP_CANVAS"],
            },
            npi: {
              name: "Now Playing: Image (Artist Image View)",
              "@input:spotify": ["NP_ARTIST_IMAGE"],
            },
            npl: {
              name: "Now Playing: Lyrics (View)",
              "@input:spotify": ["NP_LYRICS"],
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
