//#region package.json
var name = "@keychord/chords-com.apple.Safari";
var displayName = "Safari Chords";
var version = "0.0.0";
var description = "Chords for Safari (com.apple.Safari).";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-com.apple.Safari"
};
var type = "module";
var exports = { "./safari": "./js/safari.js" };
var scripts = { "test": "bun test --isolate" };
var dependencies = { "@keychord/chords-menu": "workspace:*" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"@keychord": { "chords-menu": { "chords": { "macos.toml": {
		"name": "macOS Menu Bar",
		"on": {
			"menu": {
				"file": "menu.js",
				"args": []
			},
			"tray": { "file": "tray.js" },
			"select": { "file": "selection.js" },
			"visibility": { "file": "visibility.js" }
		},
		"chords": {
			"?=": { "name": "Menu/Tray" },
			"?=[": { "name": "Menu Bar: Menus By Index" },
			"?=/": { "name": "Menu Bar: Search" },
			"=[([a-z]+(?:-[a-z]+)*[0-9]*).": {
				"name": "Menu Bar: by letter",
				"@input:menu": ["BY_LETTERS", "$1"]
			},
			"=/(.+)": {
				"name": "Menu Bar: Search $1",
				"@input:menu": ["SEARCH", "$1"]
			},
			"?=0": { "name": "Menu Bar: Apple Logo" },
			"?=\"1-9\"": { "name": "Tray: Select Icon" },
			"?=-": { "name": "Menu Bar: Notch / Tray From Right" },
			"?=-\"1-9\"": { "name": "Tray: Select From Right" },
			"?=]": { "name": "Menu Bar: Tray Icons" },
			"=([\\[\\]]?-?(?:0|[1-9][0-9]*)[lr]?[\\[\\]]*[.,]?)": {
				"name": "Menu Bar: Select / Click Item",
				"@keydown:select": ["KEYDOWN", "$1"],
				"@input:select": ["INPUT", "$1"]
			},
			"=-": {
				"name": "Menu Bar: Click Notch",
				"@input:tray": ["NOTCH"]
			},
			"=p": {
				"name": "Tray: Power / Battery",
				"@input:tray": ["BATTERY"]
			},
			"=c": {
				"name": "Tray: Control Center",
				"@input:tray": ["CONTROL_CENTER"]
			},
			"=cd": {
				"name": "Tray: Control Center > Display",
				"@input:tray": ["CONTROL_CENTER", "DISPLAY"]
			},
			"=cd-": {
				"name": "Tray: Control Center > Display > Decrease",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"DECREASE"
				]
			},
			"=cd=": {
				"name": "Tray: Control Center > Display > Increase",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"INCREASE"
				]
			},
			"=cd.": {
				"name": "Tray: Control Center > Display > Click",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"CLICK"
				]
			},
			"=cdd": {
				"name": "Tray: Control Center > Display > Dark Mode",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"DARK_MODE"
				]
			},
			"=cdn": {
				"name": "Tray: Control Center > Display > Night Shift",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"NIGHT_SHIFT"
				]
			},
			"=cdt": {
				"name": "Tray: Control Center > Display > True Tone",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"TRUE_TONE"
				]
			},
			"=cds": {
				"name": "Tray: Control Center > Display > Settings",
				"@input:tray": [
					"CONTROL_CENTER",
					"DISPLAY",
					"SETTINGS"
				]
			},
			"=cs": {
				"name": "Tray: Control Center > Sound",
				"@input:tray": ["CONTROL_CENTER", "SOUND"]
			},
			"=cs-": {
				"name": "Tray: Control Center > Sound > Decrease",
				"@input:tray": [
					"CONTROL_CENTER",
					"SOUND",
					"DECREASE"
				]
			},
			"=cs=": {
				"name": "Tray: Control Center > Sound > Increase",
				"@input:tray": [
					"CONTROL_CENTER",
					"SOUND",
					"INCREASE"
				]
			},
			"=cs.": {
				"name": "Tray: Control Center > Sound > Click",
				"@input:tray": [
					"CONTROL_CENTER",
					"SOUND",
					"CLICK"
				]
			},
			"=s": {
				"name": "Tray: Spotlight",
				"shortcut": "cmd+space"
			},
			"=t": {
				"name": "Tray: Time & Date",
				"@input:tray": ["DATE_TIME"]
			},
			"?=wi": { "name": "Tray Wi-Fi" },
			"=wi": {
				"name": "Tray: Wi-Fi",
				"@input:tray": ["WIFI"]
			},
			"=wiv": {
				"name": "Tray Wi-Fi: Vary On/Off",
				"@input:tray": ["WIFI", "TOGGLE"]
			},
			"=q": {
				"name": "Force Quit",
				"shortcut": "opt+cmd+esc"
			},
			"=ls": {
				"name": "Lock Screen",
				"shortcut": "opt+cmd+esc"
			},
			"=lo": {
				"name": "Log Out",
				"shortcut": "ctrl+cmd+q"
			},
			"=lq": {
				"name": "Log Quit",
				"shortcut": "opt+shift+cmd+q"
			},
			"?=b": { "name": "Brightness" },
			"=bu": {
				"name": "Brightness Up",
				"shortcut": "BrightnessUp"
			},
			"=bd": {
				"name": "Brightness Down",
				"shortcut": "BrightnessDown"
			},
			"=v": {
				"name": "Menu Bar: Show / Hide",
				"@input:visibility": []
			},
			"?=v": { "name": "Menu Bar Visibility / Volume" },
			"=vu": {
				"name": "Volume Up",
				"shortcut": "AudioVolumeUp"
			},
			"=vd": {
				"name": "Volume Down",
				"shortcut": "AudioVolumeDown"
			},
			"=vm": {
				"name": "Volume Mute",
				"shortcut": "AudioVolumeMute"
			},
			"?=w": { "name": "Window Menu" },
			"=w": {
				"name": "Window Menu",
				"@input:menu": ["BY_PATH", ["Window"]]
			},
			"=wl": {
				"name": "Window Menu: Left",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Left"
				]]
			},
			"=wr": {
				"name": "Window Menu: Right",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Right"
				]]
			},
			"=wt": {
				"name": "Window Menu: Top",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Top"
				]]
			},
			"=wb": {
				"name": "Window Menu: Bottom",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Bottom"
				]]
			},
			"=wtl": {
				"name": "Window Menu: Top Left",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Top Left"
				]]
			},
			"=wtr": {
				"name": "Window Menu: Top Right",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Top Right"
				]]
			},
			"=wbl": {
				"name": "Window Menu: Bottom Left",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Bottom Left"
				]]
			},
			"=wbr": {
				"name": "Window Menu: Bottom Right",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Bottom Right"
				]]
			},
			"=wlr": {
				"name": "Window Menu: Left & Right",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Left & Right"
				]]
			},
			"=wrl": {
				"name": "Window Menu: Right & Left",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Right & Left"
				]]
			},
			"=wtb": {
				"name": "Window Menu: Top & Bottom",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Top & Bottom"
				]]
			},
			"=wbt": {
				"name": "Window Menu: Bottom & Top",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Bottom & Top"
				]]
			},
			"=wq": {
				"name": "Window Menu: Quarters",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Quarters"
				]]
			},
			"=ws[": {
				"name": "Window Menu: Return to Previous Size",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Move & Resize",
					"Return to Previous Size"
				]]
			},
			"=wz": {
				"name": "Window Menu: Zoom",
				"@input:menu": ["BY_PATH", ["Window", "Zoom"]]
			},
			"=wf": {
				"name": "Window Menu: Fill",
				"@input:menu": ["BY_PATH", ["Window", "Fill"]]
			},
			"=wc": {
				"name": "Window Menu: Center",
				"@input:menu": ["BY_PATH", ["Window", "Center"]]
			},
			"=wfl": {
				"name": "Window Menu: Left of Screen",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Full Screen Tile",
					"Left of Screen"
				]]
			},
			"=wfr": {
				"name": "Window Menu: Right of Screen",
				"@input:menu": ["BY_PATH", [
					"Window",
					"Full Screen Tile",
					"Right of Screen"
				]]
			},
			"=waf": {
				"name": "Window Menu: Bring All to Front",
				"@input:menu": ["BY_PATH", ["Window", "Bring All to Front"]]
			}
		}
	} } } },
	"com": { "apple": { "Safari": { "macos.toml": {
		"name": "Safari",
		"on": {
			"menu": {
				"file": "@keychord/chords-menu/js/menu.js",
				"args": ["Safari"]
			},
			"js": { "file": "safari.js" }
		},
		"chords": {
			"?w": { "name": "Window" },
			"wn": {
				"name": "Window: New",
				"shortcut": "cmd+n"
			},
			"wp": {
				"name": "Window: Private",
				"shortcut": "cmd+shift+n"
			},
			"wq": {
				"name": "Window: Quit",
				"shortcut": "cmd+shift+w"
			},
			"wqa": {
				"name": "Window: Quit All",
				"shortcut": "cmd+alt+w"
			},
			"?t": { "name": "Tab" },
			"tn": {
				"name": "Tab: New",
				"shortcut": "cmd+t"
			},
			"tq": {
				"name": "Tab: Quit",
				"command": "Close the current tab, or pop-up",
				"shortcut": "cmd+w"
			},
			"tp": {
				"name": "Tab: Pin",
				"@input:menu": ["BY_PATH", ["Window", "Pin Tab"]]
			},
			"td": {
				"name": "Tab: Duplicate",
				"@input:menu": ["BY_PATH", ["Window", "Duplicate Tab"]]
			},
			"tw": {
				"name": "Tab: Windowize",
				"@input:menu": ["BY_PATH", ["Window", "Move Tab to New Window"]]
			},
			"t]": {
				"name": "Tab: Next",
				"command": "Jump to the next open tab",
				"shortcut": "ctrl+right"
			},
			"t[": {
				"name": "Tab: Previous",
				"command": "Jump to the previous open tab",
				"shortcut": "ctrl+shift+right"
			},
			"t1": {
				"name": "Tab 1",
				"command": "Jump to a specific tab",
				"shortcut": "cmd+1"
			},
			"t2": {
				"name": "Tab 2",
				"command": "Jump to a specific tab",
				"shortcut": "cmd+2"
			},
			"t3": {
				"name": "Tab 3",
				"command": "Jump to a specific tab",
				"shortcut": "cmd+3"
			},
			"t4": {
				"name": "Tab 4",
				"command": "Jump to a specific tab",
				"shortcut": "cmd+4"
			},
			"t5": {
				"name": "Tab 5",
				"command": "Jump to a specific tab",
				"shortcut": "cmd+5"
			},
			"t6": {
				"name": "Tab 6",
				"command": "Jump to a specific tab",
				"shortcut": "cmd+6"
			},
			"t7": {
				"name": "Tab 7",
				"command": "Jump to a specific tab",
				"shortcut": "cmd+7"
			},
			"t8": {
				"name": "Tab 8",
				"command": "Jump to a specific tab",
				"shortcut": "cmd+8"
			},
			"tl": {
				"name": "Tab: Left Move",
				"command": "Move tabs right or left",
				"shortcut": "ctrl"
			},
			"tr": {
				"name": "Tab: Right Move",
				"command": "Move tabs right or left",
				"shortcut": "cmd+shift+pgdown"
			},
			"?tg": { "name": "Tab Group" },
			"tgn": {
				"name": "Tab Group: New",
				"shortcut": "cmd+ctrl+n"
			},
			"tgq": {
				"name": "Tab Group: Quit",
				"shortcut": "cmd+ctrl+w"
			},
			"tg]": {
				"name": "Tab Group: Next",
				"shortcut": "cmd+shift+up"
			},
			"tg[": {
				"name": "Tab Group: Previous",
				"shortcut": "cmd+shift+down"
			},
			"js": {
				"name": "JavaScript",
				"@input:js": []
			}
		}
	} } } },
	"macos.toml": {
		"name": "Safari",
		"chords": { "/b": {
			"name": "Browser (Safari)",
			"shell": "open -a Safari"
		} }
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
	exports,
	scripts,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, exports, name, packageManager, repository, scripts, type, version };
