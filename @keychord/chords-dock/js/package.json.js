//#region package.json
var name = "@keychord/chords-dock";
var displayName = "Dock Chords";
var version = "0.0.2";
var description = "Open and switch apps from the macOS Dock, GNOME Dash, or Windows taskbar.";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-dock"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chords-menu": "workspace:*",
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"@keychord": { "chords-menu": { "chords": {
		"linux.toml": {
			"name": "Linux System Shortcuts",
			"meta": { "chord": ">=0.3.4" },
			"placeholders": { "<>": {
				"name": "System shortcuts prefix",
				"default": "s"
			} },
			"chords": {
				"?<>": { "name": "System Shortcuts" },
				"<>0": {
					"name": "Activities Overview",
					"shortcut": "super"
				},
				"<>a": {
					"name": "Show Applications",
					"shortcut": "super+a"
				},
				"<>c": {
					"name": "Quick Settings",
					"shortcut": "super+s"
				},
				"<>t": {
					"name": "Notifications and Calendar",
					"shortcut": "super+v"
				},
				"<>r": {
					"name": "Run Command",
					"shortcut": "alt+f2"
				},
				"<>ls": {
					"name": "Lock Screen",
					"shortcut": "super+l"
				},
				"?<>b": { "name": "Brightness" },
				"<>bu": {
					"name": "Brightness Up",
					"shortcut": "BrightnessUp"
				},
				"<>bd": {
					"name": "Brightness Down",
					"shortcut": "BrightnessDown"
				},
				"?<>v": { "name": "Volume" },
				"<>vu": {
					"name": "Volume Up",
					"shortcut": "AudioVolumeUp"
				},
				"<>vd": {
					"name": "Volume Down",
					"shortcut": "AudioVolumeDown"
				},
				"<>vm": {
					"name": "Volume Mute",
					"shortcut": "AudioVolumeMute"
				},
				"?<>w": { "name": "Window" },
				"<>w": {
					"name": "Window Menu",
					"shortcut": "alt+space"
				},
				"<>wq": {
					"name": "Close Window",
					"shortcut": "alt+f4"
				}
			}
		},
		"macos.toml": {
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
		},
		"windows.toml": {
			"name": "Windows System Shortcuts",
			"meta": { "chord": ">=0.3.4" },
			"placeholders": { "<>": {
				"name": "System shortcuts prefix",
				"default": "s"
			} },
			"chords": {
				"?<>": { "name": "System Shortcuts" },
				"<>0": {
					"name": "Start Menu",
					"shortcut": "super"
				},
				"<>i": {
					"name": "Focus Notification Area",
					"shortcut": "super+b"
				},
				"<>c": {
					"name": "Quick Settings or Action Center",
					"shortcut": "super+a"
				},
				"<>t": {
					"name": "Notifications and Calendar (Windows 11)",
					"shortcut": "super+n"
				},
				"<>r": {
					"name": "Run Dialog",
					"shortcut": "super+r"
				},
				"<>q": {
					"name": "Task Manager",
					"shortcut": "ctrl+shift+esc"
				},
				"<>ls": {
					"name": "Lock Screen",
					"shortcut": "super+l"
				},
				"?<>v": { "name": "Volume" },
				"<>vu": {
					"name": "Volume Up",
					"shortcut": "AudioVolumeUp"
				},
				"<>vd": {
					"name": "Volume Down",
					"shortcut": "AudioVolumeDown"
				},
				"<>vm": {
					"name": "Volume Mute",
					"shortcut": "AudioVolumeMute"
				},
				"?<>w": { "name": "Window" },
				"<>w": {
					"name": "Window Menu",
					"shortcut": "alt+space"
				},
				"<>wm": {
					"name": "Application Menu Bar",
					"shortcut": "f10"
				},
				"<>wq": {
					"name": "Close Window",
					"shortcut": "alt+f4"
				}
			}
		}
	} } },
	"linux.toml": {
		"name": "GNOME Dash",
		"meta": { "chord": ">=0.3.4" },
		"placeholders": { "<>": {
			"name": "Dash prefix",
			"default": "t"
		} },
		"chords": {
			"?<>": { "name": "GNOME Dash" },
			"<>v": {
				"name": "Activities Overview",
				"shortcut": "super"
			},
			"<>w[": {
				"name": "Previous Application",
				"shortcut": "super+shift+tab"
			},
			"<>w]": {
				"name": "Next Application",
				"shortcut": "super+tab"
			},
			"<>1": {
				"name": "Open or Switch to Dash App 1",
				"shortcut": "super+1"
			},
			"<>2": {
				"name": "Open or Switch to Dash App 2",
				"shortcut": "super+2"
			},
			"<>3": {
				"name": "Open or Switch to Dash App 3",
				"shortcut": "super+3"
			},
			"<>4": {
				"name": "Open or Switch to Dash App 4",
				"shortcut": "super+4"
			},
			"<>5": {
				"name": "Open or Switch to Dash App 5",
				"shortcut": "super+5"
			},
			"<>6": {
				"name": "Open or Switch to Dash App 6",
				"shortcut": "super+6"
			},
			"<>7": {
				"name": "Open or Switch to Dash App 7",
				"shortcut": "super+7"
			},
			"<>8": {
				"name": "Open or Switch to Dash App 8",
				"shortcut": "super+8"
			},
			"<>9": {
				"name": "Open or Switch to Dash App 9",
				"shortcut": "super+9"
			},
			"?<>n": { "name": "Open New Dash Window" },
			"<>n1": {
				"name": "Open New Dash Window 1",
				"shortcut": "super+ctrl+1"
			},
			"<>n2": {
				"name": "Open New Dash Window 2",
				"shortcut": "super+ctrl+2"
			},
			"<>n3": {
				"name": "Open New Dash Window 3",
				"shortcut": "super+ctrl+3"
			},
			"<>n4": {
				"name": "Open New Dash Window 4",
				"shortcut": "super+ctrl+4"
			},
			"<>n5": {
				"name": "Open New Dash Window 5",
				"shortcut": "super+ctrl+5"
			},
			"<>n6": {
				"name": "Open New Dash Window 6",
				"shortcut": "super+ctrl+6"
			},
			"<>n7": {
				"name": "Open New Dash Window 7",
				"shortcut": "super+ctrl+7"
			},
			"<>n8": {
				"name": "Open New Dash Window 8",
				"shortcut": "super+ctrl+8"
			},
			"<>n9": {
				"name": "Open New Dash Window 9",
				"shortcut": "super+ctrl+9"
			}
		}
	},
	"macos.toml": {
		"name": "macOS Dock",
		"meta": { "chord": ">=0.3.0" },
		"on": {
			"menu": { "file": "@keychord/chords-menu/js/menu.js" },
			"dock": { "file": "dock.js" },
			"application": { "file": "application.js" }
		},
		"placeholders": { "<>": {
			"name": "Dock prefix",
			"default": "d"
		} },
		"chords": {
			"?<>": { "name": "Dock" },
			"<>w[": {
				"name": "Dock: Previous App",
				"@input:application": ["PREVIOUS"]
			},
			"<>w]": {
				"name": "Dock: Next App",
				"@input:application": ["NEXT"]
			},
			"<>v": {
				"name": "Dock: Vary (On/Off)",
				"shortcut": "ctrl+f3"
			},
			"<>(\\d+)": {
				"name": "Dock > Focus $1",
				"@input:dock": ["$1"]
			},
			"<>.(\\d+).": {
				"name": "Dock > Click @ Item $1",
				"@input:dock": ["$1", "LEFT"]
			},
			"<>.,(\\d+)": {
				"name": "Dock > Right Click @ Item $1",
				"@input:dock": ["$1", "RIGHT"]
			}
		}
	},
	"windows.toml": {
		"name": "Windows Taskbar",
		"meta": { "chord": ">=0.3.4" },
		"placeholders": { "<>": {
			"name": "Taskbar prefix",
			"default": "t"
		} },
		"chords": {
			"?<>": { "name": "Windows Taskbar" },
			"<>v": {
				"name": "Focus Taskbar",
				"shortcut": "super+t"
			},
			"<>w[": {
				"name": "Previous Taskbar Item",
				"shortcut": "super+shift+t"
			},
			"<>w]": {
				"name": "Next Taskbar Item",
				"shortcut": "super+t"
			},
			"<>1": {
				"name": "Open or Switch to Taskbar App 1",
				"shortcut": "super+1"
			},
			"<>2": {
				"name": "Open or Switch to Taskbar App 2",
				"shortcut": "super+2"
			},
			"<>3": {
				"name": "Open or Switch to Taskbar App 3",
				"shortcut": "super+3"
			},
			"<>4": {
				"name": "Open or Switch to Taskbar App 4",
				"shortcut": "super+4"
			},
			"<>5": {
				"name": "Open or Switch to Taskbar App 5",
				"shortcut": "super+5"
			},
			"<>6": {
				"name": "Open or Switch to Taskbar App 6",
				"shortcut": "super+6"
			},
			"<>7": {
				"name": "Open or Switch to Taskbar App 7",
				"shortcut": "super+7"
			},
			"<>8": {
				"name": "Open or Switch to Taskbar App 8",
				"shortcut": "super+8"
			},
			"<>9": {
				"name": "Open or Switch to Taskbar App 9",
				"shortcut": "super+9"
			},
			"<>0": {
				"name": "Open or Switch to Taskbar App 10",
				"shortcut": "super+0"
			},
			"?<>n": { "name": "Open New Taskbar Window" },
			"<>n1": {
				"name": "Open New Taskbar Window 1",
				"shortcut": "super+shift+1"
			},
			"<>n2": {
				"name": "Open New Taskbar Window 2",
				"shortcut": "super+shift+2"
			},
			"<>n3": {
				"name": "Open New Taskbar Window 3",
				"shortcut": "super+shift+3"
			},
			"<>n4": {
				"name": "Open New Taskbar Window 4",
				"shortcut": "super+shift+4"
			},
			"<>n5": {
				"name": "Open New Taskbar Window 5",
				"shortcut": "super+shift+5"
			},
			"<>n6": {
				"name": "Open New Taskbar Window 6",
				"shortcut": "super+shift+6"
			},
			"<>n7": {
				"name": "Open New Taskbar Window 7",
				"shortcut": "super+shift+7"
			},
			"<>n8": {
				"name": "Open New Taskbar Window 8",
				"shortcut": "super+shift+8"
			},
			"<>n9": {
				"name": "Open New Taskbar Window 9",
				"shortcut": "super+shift+9"
			},
			"<>n0": {
				"name": "Open New Taskbar Window 10",
				"shortcut": "super+shift+0"
			},
			"?<>j": { "name": "Open Taskbar Jump List" },
			"<>j1": {
				"name": "Open Taskbar Jump List 1",
				"shortcut": "super+alt+1"
			},
			"<>j2": {
				"name": "Open Taskbar Jump List 2",
				"shortcut": "super+alt+2"
			},
			"<>j3": {
				"name": "Open Taskbar Jump List 3",
				"shortcut": "super+alt+3"
			},
			"<>j4": {
				"name": "Open Taskbar Jump List 4",
				"shortcut": "super+alt+4"
			},
			"<>j5": {
				"name": "Open Taskbar Jump List 5",
				"shortcut": "super+alt+5"
			},
			"<>j6": {
				"name": "Open Taskbar Jump List 6",
				"shortcut": "super+alt+6"
			},
			"<>j7": {
				"name": "Open Taskbar Jump List 7",
				"shortcut": "super+alt+7"
			},
			"<>j8": {
				"name": "Open Taskbar Jump List 8",
				"shortcut": "super+alt+8"
			},
			"<>j9": {
				"name": "Open Taskbar Jump List 9",
				"shortcut": "super+alt+9"
			},
			"<>j0": {
				"name": "Open Taskbar Jump List 10",
				"shortcut": "super+alt+0"
			}
		}
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
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, description, devDependencies, displayName, name, packageManager, repository, scripts, type, version };
