//#region package.json
var name = "@keychord/chords-whatsapp";
var repository = {
  type: "git",
  url: "https://github.com/KeyChord/chords-whatsapp",
};
var type = "module";
var devDependencies = {
  "@keychord/chordtest": "workspace:*",
  "@keychord/config": "catalog:",
  "@keychord/tsconfig": "catalog:",
  "@types/bun": "latest",
};
var packageManager = "pnpm@12.11.2";
var chords = {
  net: {
    whatsapp: {
      WhatsApp: {
        "macos.toml": {
          name: "WhatsApp",
          on: { whatsapp: { file: "whatsapp.js" } },
          chords: {
            "?c": { name: "Chat" },
            cq: {
              name: "Chat: Quit",
              "@input:whatsapp": ["CHAT_CLOSE"],
            },
            cb: {
              name: "Chat: Block",
              "@input:whatsapp": ["CHAT_BLOCK"],
            },
            "c/": {
              name: "Chat: Search",
              "@input:whatsapp": ["CHAT_SEARCH"],
            },
            cv: {
              name: "Chat: Video (Call)",
              "@input:whatsapp": ["CHAT_VIDEO_CALL"],
            },
            ca: {
              name: "Chat: Audio (Call)",
              "@input:whatsapp": ["CHAT_VOICE_CALL"],
            },
            co: {
              name: "Chat: Open (in new window)",
              "@input:whatsapp": ["CHAT_OPEN_WINDOW"],
            },
            cn: {
              name: "Chat: New",
              "@input:whatsapp": ["CHAT_NEW"],
            },
            cp: {
              name: "Chat: Pin",
              "@input:whatsapp": ["CHAT_PIN"],
            },
            ch: {
              name: "Chat: Hide (Archive)",
              "@input:whatsapp": ["CHAT_ARCHIVE"],
            },
            cm: {
              name: "Chat: Mute",
              "@input:whatsapp": ["CHAT_MUTE"],
            },
            cm8: {
              name: "Chat: Mute 8 Hours",
              "@input:whatsapp": ["CHAT_MUTE_8_HOURS"],
            },
            cmw: {
              name: "Chat: Mute 1 Week",
              "@input:whatsapp": ["CHAT_MUTE_1_WEEK"],
            },
            cu: {
              name: "Chat: Unread",
              "@input:whatsapp": ["CHAT_UNREAD"],
            },
            "c[": {
              name: "Chat: Previous",
              "@input:whatsapp": ["CHAT_PREVIOUS"],
            },
            "c]": {
              name: "Chat: Next",
              "@input:whatsapp": ["CHAT_NEXT"],
            },
            ce: {
              name: "Chat: Export",
              "@input:whatsapp": ["CHAT_EXPORT"],
            },
            cc: {
              name: "Chat: Clear",
              "@input:whatsapp": ["CHAT_CLEAR"],
            },
            cd: {
              name: "Chat: Delete",
              "@input:whatsapp": ["CHAT_DELETE"],
            },
            "?ci": { name: "Contact Info" },
            ci: {
              name: "Contact Info",
              "@input:whatsapp": ["CHAT_INFO"],
            },
            cii: {
              name: "Contact Info > Image (Avatar)",
              "@input:whatsapp": ["CHAT_INFO_AVATAR"],
            },
            cia: {
              name: "Contact Info > Audio (Call)",
              "@input:whatsapp": ["CHAT_INFO_VOICE"],
            },
            civ: {
              name: "Contact Info > Video",
              "@input:whatsapp": ["CHAT_INFO_VIDEO"],
            },
            "ci/": {
              name: "Contact Info > Search",
              "@input:whatsapp": ["CHAT_INFO_SEARCH"],
            },
            cig: {
              name: "Contact Info > Gallery (Media, links and docs)",
              "@input:whatsapp": ["CHAT_INFO_GALLERY"],
            },
            cis: {
              name: "Contact Info > Starred",
              "@input:whatsapp": ["CHAT_INFO_STARRED"],
            },
            cim: {
              name: "Contact Info > Mute",
              "@input:whatsapp": ["CHAT_MUTE"],
            },
            cims: {
              name: "Contact Info > Mute status (notifications)",
              "@input:whatsapp": ["CHAT_INFO_MUTE_STATUS"],
            },
            cit: {
              name: "Contact Info > Theme",
              "@input:whatsapp": ["CHAT_INFO_THEME"],
            },
            citb: {
              name: "Contact Info > Theme > Bubble",
              "@input:whatsapp": ["CHAT_INFO_THEME_BUBBLE"],
            },
            citb0: {
              name: "Contact Info > Theme > Bubble > Reset",
              "@input:whatsapp": ["CHAT_INFO_THEME_BUBBLE_RESET"],
            },
            "citb(\\d,?\\d)": {
              name: "Contact Info > Theme > Bubble @ Row, Column",
              "@input:whatsapp": ["CHAT_INFO_THEME_BUBBLE_SELECT", "$1"],
            },
            citw: {
              name: "Contact Info > Theme > Wallpaper",
              "@input:whatsapp": ["CHAT_INFO_THEME_WALLPAPER"],
            },
            "citw(\\d,?\\d)": {
              name: "Contact Info > Theme > Wallpaper @ Row, Column",
              "@input:whatsapp": ["CHAT_INFO_THEME_WALLPAPER_SELECT", "$1"],
            },
            citwp: {
              name: "Contact Info > Theme > Wallpaper > Photo",
              "@input:whatsapp": ["CHAT_INFO_THEME_WALLPAPER_PHOTO"],
            },
            citwc: {
              name: "Contact Info > Theme > Wallpaper > Colour",
              "@input:whatsapp": ["CHAT_INFO_THEME_WALLPAPER_COLOUR"],
            },
            cisd: {
              name: "Contact Info > Save (to) Downloads",
              "@input:whatsapp": ["CHAT_INFO_SAVE_DOWNLOADS"],
            },
            cidm: {
              name: "Contact Info > Disappearing Messages",
              "@input:whatsapp": ["CHAT_INFO_DISAPPEARING_MESSAGES"],
            },
            cipa: {
              name: "Contact Info > Privacy (Advanced)",
              "@input:whatsapp": ["CHAT_INFO_PRIVACY"],
            },
            cie: {
              name: "Contact Info > Encryption",
              "@input:whatsapp": ["CHAT_INFO_ENCRYPTION"],
            },
            cicd: {
              name: "Contact Info > Contact Details",
              "@input:whatsapp": ["CHAT_INFO_CONTACT_DETAILS"],
            },
            "?cig": { name: "Contact Info > Group" },
            cigc: {
              name: "Contact Info > Group: Create",
              "@input:whatsapp": ["CHAT_INFO_GROUP_CREATE"],
            },
            ciga: {
              name: "Contact Info > Group: Add (to)",
              "@input:whatsapp": ["CHAT_INFO_GROUP_ADD"],
            },
            cisc: {
              name: "Contact Info: Share Contact",
              "@input:whatsapp": ["CHAT_INFO_SHARE_CONTACT"],
            },
            cif: {
              name: "Contact Info: Favourite",
              "@input:whatsapp": ["CHAT_INFO_FAVOURITE"],
            },
            ciec: {
              name: "Contact Info: Export Chat",
              "@input:whatsapp": ["CHAT_INFO_EXPORT"],
            },
            cicc: {
              name: "Contact Info: Clear Chat",
              "@input:whatsapp": ["CHAT_INFO_CLEAR"],
            },
            cib: {
              name: "Contact Info: Block",
              "@input:whatsapp": ["CHAT_INFO_BLOCK"],
            },
            cir: {
              name: "Contact Info: Report",
              "@input:whatsapp": ["CHAT_INFO_REPORT"],
            },
            "c(\\d+)": {
              name: "Chat: Switch to Chat #",
              "@input:whatsapp": ["CHAT_SWITCH", "$1"],
            },
            "?g": { name: "Goto" },
            gc: {
              name: "Goto: Chats",
              "@input:whatsapp": ["VIEW_CHATS"],
            },
            gch: {
              name: "Goto: Chats > Hidden (Archived)",
              "@input:whatsapp": ["VIEW_ARCHIVED"],
            },
            gca: { name: "Goto: Chats > All" },
            gcu: { name: "Goto: Chats > Unread" },
            gcf: { name: "Goto: Chats > Favourites" },
            gu: {
              name: "Goto: Updates",
              "@input:whatsapp": ["VIEW_UPDATES"],
            },
            gs: { name: "Goto: Servers (Communities)" },
            gp: {
              name: "Goto: Phone (Calls)",
              "@input:whatsapp": ["VIEW_CALLS"],
            },
            ga: { name: "Goto: AI" },
            gm: { name: "Goto: Media" },
            "g,": {
              name: "Goto: Settings",
              "@input:whatsapp": ["VIEW_SETTINGS"],
            },
            "?v": { name: "Voicechat (Call)" },
            vv: {
              name: "Voicechat: Video (Toggle)",
              "@input:whatsapp": ["CALL_CAMERA"],
            },
            "vv(\\d+)": {
              name: "Voicechat: Video (Camera) @ #",
              "@input:whatsapp": ["CALL_CAMERA_SELECT", "$1"],
            },
            vm: {
              name: "Voicechat: Mic (Toggle)",
              "@input:whatsapp": ["CALL_MICROPHONE"],
            },
            "vm(\\d+)": {
              name: "Voicechat: Mic @ #",
              "@input:whatsapp": ["CALL_MICROPHONE_SELECT", "$1"],
            },
            "vs(\\d+)": {
              name: "Voicechat: Speaker @ #",
              "@input:whatsapp": ["CALL_SPEAKER_SELECT", "$1"],
            },
            vr: {
              name: "Voicechat: React",
              "@input:whatsapp": ["CALL_REACTIONS"],
            },
            "vr(\\d+)": {
              name: "Voicechat: React @ #",
              "@input:whatsapp": ["CALL_REACTION_SELECT", "$1"],
            },
            vs: {
              name: "Voicechat: Screenshare",
              "@input:whatsapp": ["CALL_SCREEN_SHARE"],
            },
            va: {
              name: "Voicechat: Add (People)",
              "@input:whatsapp": ["CALL_ADD_PEOPLE"],
            },
            vc: {
              name: "Voicechat: Chat (Toggle)",
              "@input:whatsapp": ["CALL_CHAT"],
            },
            vx: {
              name: "Voicechat: X (End Call)",
              "@input:whatsapp": ["CALL_END"],
            },
            "?i": { name: "Input" },
            ie: {
              name: "Input: Emoji",
              "@input:whatsapp": ["INPUT_EMOJI"],
            },
            ig: {
              name: "Input: GIF",
              "@input:whatsapp": ["INPUT_GIF"],
            },
            is: {
              name: "Input: Sticker",
              "@input:whatsapp": ["INPUT_STICKER"],
            },
            "?z": { name: "Zoom" },
            zi: {
              name: "Zoom In",
              "@input:whatsapp": ["ZOOM_IN"],
            },
            zo: {
              name: "Zoom Out",
              "@input:whatsapp": ["ZOOM_OUT"],
            },
            zr: {
              name: "Zoom Reset",
              "@input:whatsapp": ["ZOOM_RESET"],
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
