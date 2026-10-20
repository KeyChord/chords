//#region package.json
var name = "@keychord/chords-menu";
var displayName = "Menu Chords";
var version = "0.0.2";
var description = "Chords for app menus, menu bar extras, Control Center and menu bar visibility, in whichever app is focused.";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-menu"
};
var type = "module";
var imports = { "#/*": "./src/js/*" };
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
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
} };
var package_default = {
	name,
	displayName,
	version,
	description,
	categories,
	repository,
	type,
	imports,
	scripts,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, description, devDependencies, displayName, imports, name, packageManager, repository, scripts, type, version };
