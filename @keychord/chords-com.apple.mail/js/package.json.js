//#region package.json
var name = "@keychord/chords-com.apple.mail";
var displayName = "Mail Chords";
var version = "0.0.2";
var description = "Chords for Mail (com.apple.mail).";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-com.apple.mail"
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
	"com": { "apple": { "mail": { "macos.toml": {
		"name": "Mail",
		"on": { "menu": { "file": "@keychord/chords-menu/js/menu.js" } },
		"chords": {
			"?j": { "name": "Jump" },
			"j/": {
				"name": "Jump: Search Mailboxes",
				"@input:menu": ["BY_PATH", [
					"Edit",
					"Find",
					"Mailbox Search"
				]]
			},
			"?g": { "name": "Goto" },
			"g,": {
				"name": "Goto: Settings",
				"@input:menu": ["BY_PATH", ["Mail", "Settings…"]]
			},
			"go": {
				"name": "Goto: Open Mailbox Quickly",
				"@input:menu": ["BY_PATH", ["Mailbox", "Open Quickly…"]]
			},
			"?n": { "name": "New" },
			"nm": {
				"name": "New: Message",
				"@input:menu": ["BY_PATH", ["File", "New Message"]]
			},
			"nw": {
				"name": "New: Viewer Window",
				"@input:menu": ["BY_PATH", ["File", "New Viewer Window"]]
			},
			"nb": {
				"name": "New: Mailbox",
				"@input:menu": ["BY_PATH", ["Mailbox", "New Mailbox…"]]
			},
			"ns": {
				"name": "New: Smart Mailbox",
				"@input:menu": ["BY_PATH", ["Mailbox", "New Smart Mailbox…"]]
			},
			"?v": { "name": "View" },
			"vs": {
				"name": "View: Toggle Sidebar",
				"@input:menu": ["SEARCH", "Sidebar"]
			},
			"vf": {
				"name": "View: Toggle Favorites Bar",
				"@input:menu": ["SEARCH", "Favorites Bar"]
			},
			"vc": {
				"name": "View: Toggle Column Layout",
				"@input:menu": ["BY_PATH", ["View", "Use Column Layout"]]
			},
			"vt": {
				"name": "View: Toggle Conversations",
				"@input:menu": ["BY_PATH", ["View", "Organize by Conversation"]]
			},
			"vm": {
				"name": "View: Toggle Message Filter",
				"@input:menu": ["SEARCH", "Message Filter"]
			},
			"?s": { "name": "Sort" },
			"sd": {
				"name": "Sort: Date",
				"@input:menu": ["BY_PATH", [
					"View",
					"Sort By",
					"Date"
				]]
			},
			"sf": {
				"name": "Sort: From",
				"@input:menu": ["BY_PATH", [
					"View",
					"Sort By",
					"From"
				]]
			},
			"ss": {
				"name": "Sort: Subject",
				"@input:menu": ["BY_PATH", [
					"View",
					"Sort By",
					"Subject"
				]]
			},
			"?f": { "name": "File" },
			"fi": {
				"name": "File: Import Mailboxes",
				"@input:menu": ["BY_PATH", ["File", "Import Mailboxes…"]]
			},
			"fe": {
				"name": "File: Export Message as PDF",
				"@input:menu": ["BY_PATH", ["File", "Export as PDF…"]]
			},
			"?m": { "name": "Message" },
			"mg": {
				"name": "Message: Get New Mail",
				"@input:menu": ["BY_PATH", ["Mailbox", "Get New Mail"]]
			},
			"mr": {
				"name": "Message: Reply",
				"@input:menu": ["BY_PATH", ["Message", "Reply"]]
			},
			"ml": {
				"name": "Message: Reply All",
				"@input:menu": ["BY_PATH", ["Message", "Reply All"]]
			},
			"mf": {
				"name": "Message: Forward",
				"@input:menu": ["BY_PATH", ["Message", "Forward"]]
			},
			"ma": {
				"name": "Message: Archive",
				"@input:menu": ["BY_PATH", ["Message", "Archive"]]
			},
			"md": {
				"name": "Message: Delete",
				"@input:menu": ["BY_PATH", ["Edit", "Delete"]]
			},
			"?w": { "name": "Window" },
			"wa": {
				"name": "Window: Activity",
				"@input:menu": ["BY_PATH", ["Window", "Activity"]]
			},
			"wc": {
				"name": "Window: Connection Doctor",
				"@input:menu": ["BY_PATH", ["Window", "Connection Doctor"]]
			}
		}
	} } } },
	"macos.toml": {
		"name": "Mail",
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
