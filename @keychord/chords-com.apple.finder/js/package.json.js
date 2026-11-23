// package.json
var name = "@keychord/chords-com.apple.finder";
var displayName = "Finder Chords";
var version = "0.0.2";
var description = "Chords for Finder, GNOME Files, and Windows File Explorer.";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-com.apple.finder"
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
	"com": {
		"apple": { "finder": { "macos.toml": {
			"name": "Finder",
			"on": { "menu": { "file": "@keychord/chords-menu/js/menu.js" } },
			"chords": {
				"?g": { "name": "Goto" },
				"gr": {
					"name": "Goto Recents",
					"@input:menu": ["BY_PATH", ["Go", "Recents"]]
				},
				"gd": {
					"name": "Goto Downloads",
					"@input:menu": ["BY_PATH", ["Go", "Downloads"]]
				},
				"gdo": {
					"name": "Goto Documents",
					"@input:menu": ["BY_PATH", ["Go", "Documents"]]
				},
				"gde": {
					"name": "Goto Desktop",
					"shortcut": "cmd+shift+d"
				},
				"gh": {
					"name": "Goto Home",
					"shortcut": "cmd+shift+h"
				},
				"gc": {
					"name": "Goto Computer",
					"shortcut": "cmd+shift+c"
				},
				"gad": {
					"name": "Goto AirDrop",
					"shortcut": "cmd+shift+r"
				},
				"gn": {
					"name": "Goto Network",
					"shortcut": "cmd+shift+k"
				},
				"gid": {
					"name": "Goto iCloud Drive",
					"shortcut": "cmd+shift+i"
				},
				"gs": {
					"name": "Goto Shared",
					"@input:menu": ["BY_PATH", ["Go", "Shared"]]
				},
				"ga": {
					"name": "Goto Applications",
					"shortcut": "cmd+shift+a"
				},
				"gu": {
					"name": "Goto Utilities",
					"@input:menu": ["BY_PATH", ["Go", "Utilities"]]
				},
				"gf": {
					"name": "Goto Folder",
					"shortcut": "cmd+shift+g"
				},
				"gt": {
					"name": "Goto Trash",
					"shell": "open -b com.apple.finder \"$HOME/.Trash\""
				},
				"?d": { "name": "Directory" },
				"du": {
					"name": "Directory: Up",
					"shortcut": "cmd+up"
				},
				"duw": {
					"name": "Directory: Up Window",
					"@input:menu": ["BY_KEY", ["Go", "Enclosing Folder in New Window"]]
				},
				"?f": { "name": "File" },
				"fa": {
					"name": "File: Alias",
					"shortcut": "ctrl+cmd+a"
				},
				"fe": {
					"name": "File: Eject",
					"@input:menu": ["BY_PATH", ["File", "Eject"]]
				},
				"fc": {
					"name": "File: Compress",
					"@input:menu": ["BY_PATH", ["File", "Compress"]]
				},
				"fr": {
					"name": "File: Rename",
					"@input:menu": ["BY_PATH", ["File", "Rename"]]
				},
				"ft": {
					"name": "File: Trash",
					"@input:menu": ["BY_PATH", ["File", "Move to Trash"]]
				},
				"fd": {
					"name": "File: Duplicate",
					"shortcut": "cmd+d"
				},
				"fq": {
					"name": "File: Quick Look",
					"@input:menu": ["BY_PATH", ["File", "Quick Look"]]
				},
				"fo": {
					"name": "File: Open",
					"shortcut": "cmd+down"
				},
				"?a": { "name": "as" },
				"ai": {
					"name": "as Icons",
					"@input:menu": ["BY_PATH", ["View", "as Icons"]]
				},
				"al": {
					"name": "as List",
					"@input:menu": ["BY_PATH", ["View", "as List"]]
				},
				"ac": {
					"name": "as Columns",
					"@input:menu": ["BY_PATH", ["View", "as Columns"]]
				},
				"ag": {
					"name": "as Gallery",
					"@input:menu": ["BY_PATH", ["View", "as Gallery"]]
				},
				"?s": { "name": "Sort" },
				"sn": {
					"name": "Sort: Name",
					"@input:menu": ["BY_PATH", [
						"View",
						"Sort By",
						"Name"
					]]
				},
				"sk": {
					"name": "Sort: Kind",
					"@input:menu": ["BY_PATH", [
						"View",
						"Sort By",
						"Kind"
					]]
				},
				"so": {
					"name": "Sort: Opened Date",
					"@input:menu": ["BY_PATH", [
						"View",
						"Sort By",
						"Date Last Opened"
					]]
				},
				"sa": {
					"name": "Sort: Added Date",
					"@input:menu": ["BY_PATH", [
						"View",
						"Sort By",
						"Date Added"
					]]
				},
				"sm": {
					"name": "Sort: Modified Date",
					"@input:menu": ["BY_PATH", [
						"View",
						"Sort By",
						"Date Modified"
					]]
				},
				"sc": {
					"name": "Sort: Created Date",
					"@input:menu": ["BY_PATH", [
						"View",
						"Sort By",
						"Date Created"
					]]
				},
				"ss": {
					"name": "Sort: Size",
					"@input:menu": ["BY_PATH", [
						"View",
						"Sort By",
						"Size"
					]]
				},
				"st": {
					"name": "Sort: Tags",
					"@input:menu": ["BY_PATH", [
						"View",
						"Sort By",
						"Tags"
					]]
				},
				"?c": { "name": "Clean" },
				"cn": {
					"name": "Clean: Name",
					"@input:menu": ["BY_PATH", [
						"View",
						"Clean Up By",
						"Name"
					]]
				},
				"ck": {
					"name": "Clean: Kind",
					"@input:menu": ["BY_PATH", [
						"View",
						"Clean Up By",
						"Kind"
					]]
				},
				"cm": {
					"name": "Clean: Modified Date",
					"@input:menu": ["BY_PATH", [
						"View",
						"Clean Up By",
						"Date Modified"
					]]
				},
				"cc": {
					"name": "Clean: Created Date",
					"@input:menu": ["BY_PATH", [
						"View",
						"Clean Up By",
						"Date Created"
					]]
				},
				"cs": {
					"name": "Clean: Size",
					"@input:menu": ["BY_PATH", [
						"View",
						"Clean Up By",
						"Size"
					]]
				},
				"ct": {
					"name": "Clean: Tags",
					"@input:menu": ["BY_PATH", [
						"View",
						"Clean Up By",
						"Tags"
					]]
				},
				"?t": { "name": "Toggle" },
				"ta": {
					"name": "Tabs: All",
					"@input:menu": ["BY_PATH", ["View", "Show All Tabs"]]
				},
				"tg": {
					"name": "Toggle: Groups",
					"@input:menu": ["BY_PATH", ["View", "Use Groups"]]
				},
				"tt": {
					"name": "Toggle: Tabs",
					"@input:menu": ["SEARCH", "Tab Bar"]
				},
				"th": {
					"name": "Toggle: Hidden",
					"shortcut": "cmd+shift+."
				},
				"ts": {
					"name": "Toggle Sidebar",
					"shortcut": "cmd+ctrl+s"
				},
				"tp": {
					"name": "Toggle Preview",
					"shortcut": "cmd+shift+p"
				},
				"tb": {
					"name": "Toggle Status Bar",
					"@input:menu": ["SEARCH", "Status Bar"]
				},
				"to": {
					"name": "Toggle Toolbar",
					"shortcut": "cmd+opt+t"
				},
				"t/": {
					"name": "Toggle Path Bar",
					"shortcut": "cmd+opt+p"
				},
				"te": {
					"name": "Trash: Empty",
					"@input:menu": ["BY_PATH", ["Finder", "Empty Trash…"]]
				},
				"tef": {
					"name": "Trash: Empty Force",
					"@input:menu": ["BY_KEY", ["Finder", "Empty Trash"]]
				}
			}
		} } },
		"microsoft": { "FileExplorer": { "windows.toml": {
			"name": "File Explorer",
			"executables": ["CabinetWClass", "ExploreWClass"],
			"meta": { "chord": ">=0.3.4" },
			"chords": {
				"?g": { "name": "Navigation" },
				"gb": {
					"name": "Go Back",
					"shortcut": "alt+left"
				},
				"gn": {
					"name": "Go Forward",
					"shortcut": "alt+right"
				},
				"gf": {
					"name": "Enter Folder Location",
					"shortcut": "ctrl+l"
				},
				"g/": {
					"name": "Search Files",
					"shortcut": "ctrl+f"
				},
				"gr": {
					"name": "Refresh Folder",
					"shortcut": "f5"
				},
				"?d": { "name": "Folder" },
				"du": {
					"name": "Go to Parent Folder",
					"shortcut": "alt+up"
				},
				"dn": {
					"name": "Create Folder",
					"shortcut": "ctrl+shift+n"
				},
				"dw": {
					"name": "Open New Window",
					"shortcut": "ctrl+n"
				},
				"?f": { "name": "Files and Selection" },
				"fa": {
					"name": "Select All",
					"shortcut": "ctrl+a"
				},
				"fr": {
					"name": "Rename Selected Item",
					"shortcut": "f2"
				},
				"fp": {
					"name": "Show Properties",
					"shortcut": "alt+enter"
				},
				"fm": {
					"name": "Open Context Menu",
					"shortcut": "shift+f10"
				},
				"fc": {
					"name": "Copy Selected Items",
					"shortcut": "ctrl+c"
				},
				"fx": {
					"name": "Cut Selected Items",
					"shortcut": "ctrl+x"
				},
				"fv": {
					"name": "Paste Items",
					"shortcut": "ctrl+v"
				},
				"?a": { "name": "View" },
				"ai": {
					"name": "Show Large Icons",
					"shortcut": "ctrl+shift+2"
				},
				"al": {
					"name": "Show Details View",
					"shortcut": "ctrl+shift+6"
				},
				"ap": {
					"name": "Toggle Preview Pane",
					"shortcut": "alt+p"
				},
				"ad": {
					"name": "Toggle Details Pane",
					"shortcut": "alt+shift+p"
				},
				"?t": { "name": "Tabs (Windows 11)" },
				"tn": {
					"name": "Open New Tab",
					"shortcut": "ctrl+t"
				},
				"tc": {
					"name": "Close Current Tab or Window",
					"shortcut": "ctrl+w"
				},
				"t[": {
					"name": "Previous Tab",
					"shortcut": "ctrl+shift+tab"
				},
				"t]": {
					"name": "Next Tab",
					"shortcut": "ctrl+tab"
				}
			}
		} } }
	},
	"linux.toml": {
		"name": "GNOME Files",
		"meta": { "chord": ">=0.3.4" },
		"placeholders": { "<>": {
			"name": "Finder prefix",
			"default": "/"
		} },
		"chords": { "<>f": {
			"name": "Open GNOME Files",
			"shell": "gtk-launch -- org.gnome.Nautilus"
		} }
	},
	"macos.toml": {
		"name": "Finder",
		"meta": { "chord": ">=0.3.0" },
		"placeholders": { "<>": {
			"name": "Finder prefix",
			"default": "/"
		} },
		"chords": { "<>f": {
			"name": "Finder",
			"shell": "open -a Finder"
		} }
	},
	"org": { "gnome": { "Nautilus": { "linux.toml": {
		"name": "GNOME Files",
		"executables": ["nautilus", "org.gnome.Nautilus"],
		"meta": { "chord": ">=0.3.4" },
		"chords": {
			"?g": { "name": "Navigation" },
			"gb": {
				"name": "Go Back",
				"shortcut": "alt+left"
			},
			"gn": {
				"name": "Go Forward",
				"shortcut": "alt+right"
			},
			"gh": {
				"name": "Go to Home Folder",
				"shortcut": "alt+home"
			},
			"gf": {
				"name": "Enter Folder Location",
				"shortcut": "ctrl+l"
			},
			"g/": {
				"name": "Search Files",
				"shortcut": "ctrl+f"
			},
			"gr": {
				"name": "Refresh Folder",
				"shortcut": "f5"
			},
			"?d": { "name": "Folder" },
			"du": {
				"name": "Go to Parent Folder",
				"shortcut": "alt+up"
			},
			"dn": {
				"name": "Create Folder",
				"shortcut": "ctrl+shift+n"
			},
			"db": {
				"name": "Bookmark Current Folder",
				"shortcut": "ctrl+d"
			},
			"dw": {
				"name": "Open New Window",
				"shortcut": "ctrl+n"
			},
			"?f": { "name": "Files and Selection" },
			"fa": {
				"name": "Select All",
				"shortcut": "ctrl+a"
			},
			"fi": {
				"name": "Invert Selection",
				"shortcut": "ctrl+shift+i"
			},
			"fr": {
				"name": "Rename Selected Item",
				"shortcut": "f2"
			},
			"fo": {
				"name": "Open Selected Item",
				"shortcut": "ctrl+o"
			},
			"fp": {
				"name": "Show Properties",
				"shortcut": "alt+enter"
			},
			"fm": {
				"name": "Open Context Menu",
				"shortcut": "shift+f10"
			},
			"fc": {
				"name": "Copy Selected Items",
				"shortcut": "ctrl+c"
			},
			"fx": {
				"name": "Cut Selected Items",
				"shortcut": "ctrl+x"
			},
			"fv": {
				"name": "Paste Items",
				"shortcut": "ctrl+v"
			},
			"?a": { "name": "View" },
			"ai": {
				"name": "Show Icons",
				"shortcut": "ctrl+2"
			},
			"al": {
				"name": "Show List",
				"shortcut": "ctrl+1"
			},
			"ah": {
				"name": "Toggle Hidden Files",
				"shortcut": "ctrl+h"
			},
			"as": {
				"name": "Toggle Sidebar",
				"shortcut": "f9"
			},
			"?t": { "name": "Tabs" },
			"tn": {
				"name": "Open New Tab",
				"shortcut": "ctrl+t"
			},
			"tc": {
				"name": "Close Current Tab or Window",
				"shortcut": "ctrl+w"
			},
			"t[": {
				"name": "Previous Tab",
				"shortcut": "ctrl+pageup"
			},
			"t]": {
				"name": "Next Tab",
				"shortcut": "ctrl+pagedown"
			}
		}
	} } } },
	"windows.toml": {
		"name": "File Explorer",
		"meta": { "chord": ">=0.3.4" },
		"placeholders": { "<>": {
			"name": "Finder prefix",
			"default": "/"
		} },
		"chords": { "<>f": {
			"name": "Open File Explorer",
			"shortcut": "super+e"
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
	scripts,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, name, packageManager, repository, scripts, type, version };
