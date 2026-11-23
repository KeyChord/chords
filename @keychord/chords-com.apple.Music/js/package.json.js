//#region package.json
var name = "@keychord/chords-com.apple.Music";
var displayName = "Music Chords";
var version = "0.0.2";
var description = "Chords for Music (com.apple.Music).";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-com.apple.Music"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var dependencies = { "@keychord/chords-menu": "workspace:*" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"@keychord": { "chords-menu": { "chords": { "macos.toml": {
		"name": "macOS Menu Bar",
		"meta": { "chord": ">=0.3.0" },
		"on": {
			"menu": {
				"file": "menu.js",
				"args": []
			},
			"tray": { "file": "tray.js" },
			"select": { "file": "selection.js" },
			"visibility": { "file": "visibility.js" },
			"media": { "file": "media.js" }
		},
		"placeholders": { "<>": {
			"name": "Menu bar prefix",
			"default": "b"
		} },
		"chords": {
			"?<>": { "name": "Menu Bar" },
			"?<>[": { "name": "Menu Bar: Menus By Index" },
			"?<>/": { "name": "Menu Bar: Search" },
			"<>[([a-z]+(?:-[a-z]+)*[0-9]*).": {
				"name": "Menu Bar: by letter",
				"@input:menu": ["BY_LETTERS", "$1"]
			},
			"<>/(.+)": {
				"name": "Menu Bar: Search $1",
				"@input:menu": ["SEARCH", "$1"]
			},
			"?<>0": { "name": "Menu Bar: Apple Logo" },
			"?<>\"1-9\"": { "name": "Tray: Select Icon" },
			"?<>-": { "name": "Menu Bar: Notch / Tray From Right" },
			"?<>-\"1-9\"": { "name": "Tray: Select From Right" },
			"?<>]": { "name": "Menu Bar: Tray Icons" },
			"<>([\\[\\]]?-?(?:0|[1-9][0-9]*)[lr]?[\\[\\]]*[.,]?)": {
				"name": "Menu Bar: Select / Click Item",
				"@keydown:select": ["KEYDOWN", "$1"],
				"@input:select": ["INPUT", "$1"]
			},
			"<>-": {
				"name": "Menu Bar: Click Notch",
				"@input:tray": ["NOTCH"]
			},
			"<>p": {
				"name": "Tray: Power / Battery",
				"@input:tray": ["BATTERY"]
			},
			"<>c": {
				"name": "Tray: Control Center",
				"@input:tray": ["CONTROL_CENTER"]
			},
			"<>cd": {
				"name": "Tray: Control Center > Display",
				"@input:tray": ["CONTROL_CENTER", "DISPLAY"]
			},
			"<>cd-": {
				"name": "Tray: Control Center > Display > Decrease",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"DECREASE"
				]
			},
			"<>cd=": {
				"name": "Tray: Control Center > Display > Increase",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"INCREASE"
				]
			},
			"<>cd.": {
				"name": "Tray: Control Center > Display > Click",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"CLICK"
				]
			},
			"<>cdd": {
				"name": "Tray: Control Center > Display > Dark Mode",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"DARK_MODE"
				]
			},
			"<>cdn": {
				"name": "Tray: Control Center > Display > Night Shift",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"NIGHT_SHIFT"
				]
			},
			"<>cdt": {
				"name": "Tray: Control Center > Display > True Tone",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"TRUE_TONE"
				]
			},
			"<>cds": {
				"name": "Tray: Control Center > Display > Settings",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"SETTINGS"
				]
			},
			"<>cs": {
				"name": "Tray: Control Center > Sound",
				"@input:tray": ["CONTROL_CENTER", "SOUND"]
			},
			"<>cs-": {
				"name": "Tray: Control Center > Sound > Decrease",
				"@input:tray": [
					"CONTROL_CENTER",
					"SOUND",
					"DECREASE"
				]
			},
			"<>cs=": {
				"name": "Tray: Control Center > Sound > Increase",
				"@input:tray": [
					"CONTROL_CENTER",
					"SOUND",
					"INCREASE"
				]
			},
			"<>cs.": {
				"name": "Tray: Control Center > Sound > Click",
				"@input:tray": [
					"CONTROL_CENTER",
					"SOUND",
					"CLICK"
				]
			},
			"<>t": {
				"name": "Tray: Time & Date",
				"@input:tray": ["DATE_TIME"]
			},
			"?<>cw": { "name": "Tray Wi-Fi" },
			"<>cw": {
				"name": "Tray: Wi-Fi",
				"@input:tray": ["WIFI"]
			},
			"<>cwv": {
				"name": "Tray Wi-Fi: Vary On/Off",
				"@input:tray": ["WIFI", "TOGGLE"]
			},
			"<>q": {
				"name": "Force Quit",
				"@input:menu": ["BY_PATH", ["Apple", "Force Quit…"]]
			},
			"<>ls": {
				"name": "Lock Screen",
				"shortcut": "ctrl+cmd+q"
			},
			"<>lo": {
				"name": "Log Out",
				"shortcut": "shift+cmd+q"
			},
			"<>lq": {
				"name": "Log Quit",
				"shortcut": "opt+shift+cmd+q"
			},
			"?<>b": { "name": "Brightness" },
			"<>bu": {
				"name": "Brightness Up",
				"@input:media": ["BRIGHTNESS_UP"]
			},
			"<>bd": {
				"name": "Brightness Down",
				"@input:media": ["BRIGHTNESS_DOWN"]
			},
			"<>v": {
				"name": "Menu Bar: Show / Hide",
				"@input:visibility": []
			},
			"?<>v": { "name": "Menu Bar Visibility / Volume" },
			"<>vu": {
				"name": "Volume Up",
				"@input:media": ["VOLUME_UP"]
			},
			"<>vd": {
				"name": "Volume Down",
				"@input:media": ["VOLUME_DOWN"]
			},
			"<>vm": {
				"name": "Volume Mute",
				"@input:media": ["VOLUME_MUTE"]
			},
			"?<>w": { "name": "Window" },
			"<>w": {
				"name": "Window Menu",
				"@input:menu": ["BY_PATH", ["Window"]]
			},
			"<>wq": {
				"name": "Window: Quit",
				"shortcut": "cmd+q"
			},
			"<>wh": {
				"name": "Window: Hide",
				"shortcut": "cmd+h"
			},
			"<>wm": {
				"name": "Window: Minimize",
				"shortcut": "cmd+m"
			},
			"<>wl": {
				"name": "Window Menu: Left",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Left"
				]]
			},
			"<>wr": {
				"name": "Window Menu: Right",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Right"
				]]
			},
			"<>wt": {
				"name": "Window Menu: Top",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Top"
				]]
			},
			"<>wb": {
				"name": "Window Menu: Bottom",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Bottom"
				]]
			},
			"<>wtl": {
				"name": "Window Menu: Top Left",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Top Left"
				]]
			},
			"<>wtr": {
				"name": "Window Menu: Top Right",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Top Right"
				]]
			},
			"<>wbl": {
				"name": "Window Menu: Bottom Left",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Bottom Left"
				]]
			},
			"<>wbr": {
				"name": "Window Menu: Bottom Right",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Bottom Right"
				]]
			},
			"<>wlr": {
				"name": "Window Menu: Left & Right",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Left & Right"
				]]
			},
			"<>wrl": {
				"name": "Window Menu: Right & Left",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Right & Left"
				]]
			},
			"<>wtb": {
				"name": "Window Menu: Top & Bottom",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Top & Bottom"
				]]
			},
			"<>wbt": {
				"name": "Window Menu: Bottom & Top",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Bottom & Top"
				]]
			},
			"<>wx": {
				"name": "Window Menu: Quarters",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Quarters"
				]]
			},
			"<>wo": {
				"name": "Window Menu: Return to Previous Size",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Return to Previous Size"
				]]
			},
			"<>wz": {
				"name": "Window Menu: Zoom",
				"@input:menu": ["BY_PATH", ["Window", "Zoom"]]
			},
			"<>wf": {
				"name": "Window Menu: Fill",
				"@input:menu": ["BY_PATH", ["Window", "Fill"]]
			},
			"<>wc": {
				"name": "Window Menu: Center",
				"@input:menu": ["BY_PATH", ["Window", "Center"]]
			},
			"<>wfl": {
				"name": "Window Menu: Left of Screen",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Full Screen Tile",
					"Left of Screen"
				]]
			},
			"<>wfr": {
				"name": "Window Menu: Right of Screen",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Full Screen Tile",
					"Right of Screen"
				]]
			},
			"<>waf": {
				"name": "Window Menu: Bring All to Front",
				"@input:menu": ["BY_PATH", ["Window", "Bring All to Front"]]
			}
		}
	} } } },
	"com": { "apple": { "Music": { "macos.toml": {
		"name": "Music",
		"on": { "menu": { "file": "@keychord/chords-menu/js/menu.js" } },
		"chords": {
			"?a": { "name": "App" },
			"a,": {
				"name": "App: Settings",
				"@input:menu": ["BY_PATH", ["Music", "Settings…"]]
			},
			"?g": { "name": "Goto" },
			"g/": {
				"name": "Goto: Search",
				"shortcut": "cmd+f"
			},
			"gr": {
				"name": "Goto: Recently Added",
				"shortcut": "ctrl+cmd+1"
			},
			"ga": {
				"name": "Goto: Artists",
				"shortcut": "ctrl+cmd+2"
			},
			"gb": {
				"name": "Goto: Albums",
				"shortcut": "ctrl+cmd+3"
			},
			"gs": {
				"name": "Goto: Songs",
				"shortcut": "ctrl+cmd+4"
			},
			"?n": { "name": "New" },
			"np": {
				"name": "New: Playlist",
				"@input:menu": ["BY_PATH", [
					"File",
					"New",
					"Playlist"
				]]
			},
			"ns": {
				"name": "New: Smart Playlist",
				"@input:menu": ["BY_PATH", [
					"File",
					"New",
					"Smart Playlist"
				]]
			},
			"nf": {
				"name": "New: Playlist Folder",
				"@input:menu": ["BY_PATH", [
					"File",
					"New",
					"Playlist Folder"
				]]
			},
			"?f": { "name": "File" },
			"fi": {
				"name": "File: Import",
				"@input:menu": ["BY_PATH", ["File", "Import…"]]
			},
			"fu": {
				"name": "File: Open Stream URL",
				"@input:menu": ["BY_PATH", ["File", "Open Stream URL…"]]
			},
			"fe": {
				"name": "File: Export Library",
				"@input:menu": ["BY_PATH", [
					"File",
					"Library",
					"Export Library…"
				]]
			},
			"?v": { "name": "View" },
			"vn": {
				"name": "View: Playing Next",
				"@input:menu": ["SEARCH", "Playing Next"]
			},
			"vb": {
				"name": "View: Status Bar",
				"@input:menu": ["SEARCH", "Status Bar"]
			},
			"ve": {
				"name": "View: Equalizer",
				"@input:menu": ["BY_PATH", ["Window", "Equalizer"]]
			},
			"?p": { "name": "Playback" },
			"pp": {
				"name": "Playback: Play",
				"@input:menu": ["BY_PATH", ["Controls", "Play"]]
			},
			"ph": {
				"name": "Playback: Pause",
				"@input:menu": ["BY_PATH", ["Controls", "Pause"]]
			},
			"p[": {
				"name": "Playback: Previous Track",
				"@input:menu": ["BY_PATH", ["Controls", "Previous Track"]]
			},
			"p]": {
				"name": "Playback: Next Track",
				"@input:menu": ["BY_PATH", ["Controls", "Next Track"]]
			},
			"pro": {
				"name": "Playback: Repeat Off",
				"@input:menu": ["BY_PATH", [
					"Controls",
					"Repeat",
					"Off"
				]]
			},
			"pra": {
				"name": "Playback: Repeat All",
				"@input:menu": ["BY_PATH", [
					"Controls",
					"Repeat",
					"All"
				]]
			},
			"pr1": {
				"name": "Playback: Repeat One",
				"@input:menu": ["BY_PATH", [
					"Controls",
					"Repeat",
					"One"
				]]
			},
			"?pr": { "name": "Repeat" }
		}
	} } } },
	"macos.toml": {
		"name": "Music",
		"chords": {}
	}
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
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, name, packageManager, repository, scripts, type, version };
