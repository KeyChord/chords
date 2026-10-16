//#region package.json
var name = "@keychord/chords-com.apple";
var version = "0.0.0";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-com.apple"
};
var type = "module";
var dependencies = {
	"@keychord/chords-click": "workspace:*",
	"@keychord/chords-menu": "workspace:*",
	"desm": "latest",
	"get-port": "latest",
	"jquery-as-string": "latest",
	"ky": "^2.2.0",
	"outdent": "latest"
};
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
	"com": { "apple": {
		"AOSUIPrefPaneLauncher": { "macos.toml": {
			"name": "AOSUIPrefPaneLauncher",
			"chords": {}
		} },
		"AVB-Audio-Configuration": { "macos.toml": {
			"name": "AVB Configuration",
			"chords": {}
		} },
		"AboutThisMacLauncher": { "macos.toml": {
			"name": "About This Mac",
			"chords": {}
		} },
		"AccessibilityInspector": { "macos.toml": {
			"name": "Accessibility Inspector",
			"chords": {
				"?i": { "name": "Inspect" },
				"ir": {
					"name": "Inspect: Refresh",
					"shortcut": "cmd+r"
				},
				"ip": {
					"name": "Inspect: Point",
					"shortcut": "cmd+ctrl+alt+shift+p"
				},
				"iu": {
					"name": "Inspect: Up Hierarchy - Parent",
					"shortcut": "cmd+ctrl+up"
				},
				"id": {
					"name": "Inspect: Down Hierarchy - Child",
					"shortcut": "cmd+ctrl+down"
				},
				"i[": {
					"name": "Inspect: Previous",
					"shortcut": "cmd+ctrl+left"
				},
				"i]": {
					"name": "Inspect: Next",
					"shortcut": "cmd+ctrl+right"
				},
				"?v": { "name": "Vary" },
				"va": { "name": "Vary Auto-Interact" },
				"vc": { "name": "Vary Class" },
				"vi": { "name": "Vary Ignored" }
			}
		} },
		"AccessibilityUIServer": { "macos.toml": {
			"name": "AccessibilityUIServer",
			"chords": {}
		} },
		"ActivityMonitor": { "macos.toml": {
			"name": "Activity Monitor",
			"handler": { "menu": { "file": "@keychord/chords-menu/js/menu.js" } },
			"chords": {
				"?v": { "name": "View" },
				"va": {
					"name": "View: All Processes",
					"@input:menu": ["BY_PATH", ["View", "All Processes"]]
				},
				"vh": {
					"name": "View: Hierarchially, All Processes",
					"@input:menu": ["BY_PATH", ["View", "All Processes, Hierarchically"]]
				},
				"vm": {
					"name": "View: My Processes",
					"@input:menu": ["BY_PATH", ["View", "My Processes"]]
				},
				"vs": {
					"name": "View: Selected Processes",
					"@input:menu": ["BY_PATH", ["View", "Selected Processes"]]
				},
				"vy": {
					"name": "View: System Processes",
					"@input:menu": ["BY_PATH", ["View", "System Processes"]]
				},
				"vo": {
					"name": "View: Other Users' Processes",
					"@input:menu": ["BY_PATH", ["View", "Other Users’ Processes"]]
				},
				"vc": {
					"name": "View: Current (Active) Processes",
					"@input:menu": ["BY_PATH", ["View", "Active Processes"]]
				},
				"vi": {
					"name": "View: Inactive Processes",
					"@input:menu": ["BY_PATH", ["View", "Inactive Processes"]]
				},
				"vg": {
					"name": "View: GPU Processes",
					"@input:menu": ["BY_PATH", ["View", "GPU Processes"]]
				},
				"vw": {
					"name": "View: Windowed Processes",
					"@input:menu": ["BY_PATH", ["View", "Windowed Processes"]]
				},
				"vl": {
					"name": "View: Last 12 Hour Applications",
					"@input:menu": ["BY_PATH", ["View", "Applications in last 12 hours"]]
				},
				"vp": {
					"name": "View: Processes, by GPU",
					"@input:menu": ["BY_PATH", ["View", "Processes, by GPU"]]
				},
				"?p": { "name": "Process" },
				"pf": {
					"name": "Process: Filter",
					"@input:menu": ["BY_PATH", ["View", "Filter Processes"]]
				},
				"pi": {
					"name": "Process: Inspect",
					"@input:menu": ["BY_PATH", ["View", "Inspect Process"]]
				},
				"ps": {
					"name": "Process: Sample",
					"@input:menu": ["BY_PATH", ["View", "Sample Process"]]
				},
				"pq": {
					"name": "Process: Quit",
					"@input:menu": ["BY_PATH", ["View", "Quit Process"]]
				},
				"pss": {
					"name": "Process: Send Signal",
					"@input:menu": ["BY_PATH", ["View", "Send Signal to Process..."]]
				},
				"psd": {
					"name": "Process: Show Deltas",
					"@input:menu": ["BY_PATH", ["View", "Show Deltas for Process"]]
				},
				"?r": { "name": "Run" },
				"rs": {
					"name": "Run: Spindump",
					"@input:menu": ["BY_PATH", ["View", "Run Spindump"]]
				},
				"rd": {
					"name": "Run: Diagonstics for System",
					"@input:menu": ["BY_PATH", ["View", "Run System Diagnostics..."]]
				},
				"?c": { "name": "Columns" },
				"cpi": {
					"name": "Columns: Process ID",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Process ID"
					]]
				},
				"cu": {
					"name": "Columns: User",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"User"
					]]
				},
				"cpc": {
					"name": "Columns: % CPU",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"% CPU"
					]]
				},
				"cct": {
					"name": "Columns: CPU Time",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"CPU Time"
					]]
				},
				"cpg": {
					"name": "Columns: % GPU",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"% GPU"
					]]
				},
				"cgt": {
					"name": "Columns: GPU Time",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"GPU Time"
					]]
				},
				"cnt": {
					"name": "Columns: # Threads",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"# Threads"
					]]
				},
				"cnp": {
					"name": "Columns: # Ports",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"# Ports"
					]]
				},
				"crm": {
					"name": "Columns: Real Memory",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Real Memory"
					]]
				},
				"crpm": {
					"name": "Columns: Real Private Memory",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Real Private Memory"
					]]
				},
				"crsm": {
					"name": "Columns: Real Shared Memory",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Real Shared Memory"
					]]
				},
				"ck": {
					"name": "Columns: Kind",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Kind"
					]]
				},
				"cst": {
					"name": "Columns: Sudden Termination",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Sudden Termination"
					]]
				},
				"cs": {
					"name": "Columns: Sandbox",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Sandbox"
					]]
				},
				"cr": {
					"name": "Columns: Restricted",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Restricted"
					]]
				},
				"ciwu": {
					"name": "Columns: Idle Wake Ups",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Idle Wake Ups"
					]]
				},
				"cei": {
					"name": "Columns: Energy Impact",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Energy Impact"
					]]
				},
				"can": {
					"name": "Columns: App Nap",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"App Nap"
					]]
				},
				"csb": {
					"name": "Columns: Sent Bytes",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Sent Bytes"
					]]
				},
				"csp": {
					"name": "Columns: Sent Packets",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Sent Packets"
					]]
				},
				"crb": {
					"name": "Columns: Received Bytes",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Received Bytes"
					]]
				},
				"crp": {
					"name": "Columns: Received Packets",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Received Packets"
					]]
				},
				"cpm": {
					"name": "Columns: Purgeable Memory",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Purgeable Memory"
					]]
				},
				"cm": {
					"name": "Columns: Memory",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Memory"
					]]
				},
				"ccm": {
					"name": "Columns: Compressed Memory",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Compressed Memory"
					]]
				},
				"cbw": {
					"name": "Columns: Bytes Written",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Bytes Written"
					]]
				},
				"cbr": {
					"name": "Columns: Bytes Read",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Bytes Read"
					]]
				},
				"cps": {
					"name": "Columns: Preventing Sleep",
					"@input:menu": ["BY_PATH", [
						"View",
						"Columns",
						"Preventing Sleep"
					]]
				}
			}
		} },
		"AddressBook": {
			"UrlForwarder": { "macos.toml": {
				"name": "AddressBookUrlForwarder",
				"chords": {}
			} },
			"macos.toml": {
				"name": "Contacts",
				"chords": {}
			}
		},
		"AirPlayUIAgent": { "macos.toml": {
			"name": "AirPlayUIAgent",
			"chords": {}
		} },
		"AppStore": { "macos.toml": {
			"name": "App Store",
			"chords": {}
		} },
		"AppleScriptUtility": { "macos.toml": {
			"name": "AppleScript Utility",
			"chords": {}
		} },
		"Automator": {
			"Automator-Application-Stub": { "macos.toml": {
				"name": "Automator Application Stub",
				"chords": {}
			} },
			"macos.toml": {
				"name": "Automator",
				"chords": {}
			}
		},
		"AutomatorInstaller": { "macos.toml": {
			"name": "Automator Installer",
			"chords": {}
		} },
		"Batteries": { "macos.toml": {
			"name": "Batteries",
			"chords": {}
		} },
		"BluetoothFileExchange": { "macos.toml": {
			"name": "Bluetooth File Exchange",
			"chords": {}
		} },
		"BluetoothSetupAssistant": { "macos.toml": {
			"name": "BluetoothSetupAssistant",
			"chords": {}
		} },
		"BluetoothUIServer": { "macos.toml": {
			"name": "BluetoothUIServer",
			"chords": {}
		} },
		"BluetoothUIService": { "macos.toml": {
			"name": "BluetoothUIService",
			"chords": {}
		} },
		"CalendarFileHandler": { "macos.toml": {
			"name": "CalendarFileHandler",
			"chords": {}
		} },
		"CaptiveNetworkAssistant": { "macos.toml": {
			"name": "Captive Network Assistant",
			"chords": {}
		} },
		"CertificateAssistant": { "macos.toml": {
			"name": "Certificate Assistant",
			"chords": {}
		} },
		"Chess": { "macos.toml": {
			"name": "Chess",
			"chords": {}
		} },
		"ClockAngel": { "macos.toml": {
			"name": "ClockAngel",
			"chords": {}
		} },
		"CloudKit": { "ShareBear": { "macos.toml": {
			"name": "iCloud",
			"chords": {}
		} } },
		"ColorSyncUtility": { "macos.toml": {
			"name": "ColorSync Utility",
			"chords": {}
		} },
		"Compressor": { "macos.toml": {
			"name": "Compressor",
			"chords": {}
		} },
		"CompressorApp": { "macos.toml": {
			"name": "Compressor: Encode Media",
			"chords": {}
		} },
		"Console": { "macos.toml": {
			"name": "Console",
			"chords": {}
		} },
		"CoreLocationAgent": { "macos.toml": {
			"name": "CoreLocationAgent",
			"chords": {}
		} },
		"CreateML": { "macos.toml": {
			"name": "Create ML",
			"chords": {}
		} },
		"DVDPlayer": { "macos.toml": {
			"name": "DVD Player",
			"chords": {}
		} },
		"DeskCam": { "macos.toml": {
			"name": "Desk View",
			"chords": {}
		} },
		"DiagnosticsModeAssistant": { "macos.toml": {
			"name": "Apple Diagnostics",
			"chords": {}
		} },
		"DiagnosticsReporter": { "macos.toml": {
			"name": "Diagnostics Reporter",
			"chords": {}
		} },
		"Dictionary": { "macos.toml": {
			"name": "Dictionary",
			"chords": {}
		} },
		"DigitalColorMeter": { "macos.toml": {
			"name": "Digital Color Meter",
			"chords": {}
		} },
		"DirectoryUtility": { "macos.toml": {
			"name": "Directory Utility",
			"chords": {}
		} },
		"DiscHelper": { "macos.toml": {
			"name": "DiscHelper",
			"chords": {}
		} },
		"DiskImageMounter": { "macos.toml": {
			"name": "DiskImageMounter",
			"chords": {}
		} },
		"DiskUtility": { "macos.toml": {
			"name": "Disk Utility",
			"chords": {}
		} },
		"DwellControl": { "macos.toml": {
			"name": "Dwell Control",
			"chords": {}
		} },
		"EnhancedLogging": { "macos.toml": {
			"name": "Enhanced Logging",
			"chords": {}
		} },
		"EraseAssistant": { "macos.toml": {
			"name": "Erase Assistant",
			"chords": {}
		} },
		"EscrowSecurityAlert": { "macos.toml": {
			"name": "EscrowSecurityAlert",
			"chords": {}
		} },
		"ExpansionSlotUtility": { "macos.toml": {
			"name": "Expansion Slot Utility",
			"chords": {}
		} },
		"FaceTime": { "macos.toml": {
			"name": "FaceTime",
			"chords": {}
		} },
		"Family": { "macos.toml": {
			"name": "Family",
			"chords": {}
		} },
		"FamilyExtensionHost": { "macos.toml": {
			"name": "FamilyExtensionHost",
			"chords": {}
		} },
		"FileMerge": { "macos.toml": {
			"name": "FileMerge",
			"chords": {}
		} },
		"FileProvider-Feedback": { "macos.toml": {
			"name": "FileProvider-Feedback",
			"chords": {}
		} },
		"FinalCut": { "macos.toml": {
			"name": "Final Cut Pro",
			"chords": {}
		} },
		"FinalCutApp": { "macos.toml": {
			"name": "Final Cut Pro: Create Video",
			"chords": {}
		} },
		"FolderActionsDispatcher": { "macos.toml": {
			"name": "FolderActionsDispatcher",
			"chords": {}
		} },
		"FolderActionsSetup": { "macos.toml": {
			"name": "Folder Actions Setup",
			"chords": {}
		} },
		"FontBook": { "macos.toml": {
			"name": "Font Book",
			"chords": {}
		} },
		"GameOverlayUI": { "macos.toml": {
			"name": "GameOverlayUI",
			"chords": {}
		} },
		"GameTrampoline": { "macos.toml": {
			"name": "GameTrampoline",
			"chords": {}
		} },
		"GenerativePlaygroundApp": { "macos.toml": {
			"name": "Image Playground",
			"chords": {}
		} },
		"Home": { "macos.toml": {
			"name": "Home",
			"chords": {}
		} },
		"IOUIAgent": { "macos.toml": {
			"name": "IOUIAgent",
			"chords": {}
		} },
		"IPAInstaller": { "macos.toml": {
			"name": "iOS App Installer",
			"chords": {}
		} },
		"IconComposer": { "macos.toml": {
			"name": "Icon Composer",
			"chords": {}
		} },
		"Image_Capture": { "macos.toml": {
			"name": "Image Capture",
			"chords": {}
		} },
		"InstallAssistant": {
			"Catalina": { "macos.toml": {
				"name": "macOS Catalina",
				"chords": {}
			} },
			"ElCapitan2": { "macos.toml": {
				"name": "OS X El Capitan",
				"chords": {}
			} },
			"HighSierra": { "macos.toml": {
				"name": "macOS High Sierra",
				"chords": {}
			} },
			"Mojave": { "macos.toml": {
				"name": "macOS Mojave",
				"chords": {}
			} },
			"Sierra": { "macos.toml": {
				"name": "macOS Sierra",
				"chords": {}
			} },
			"macOSBigSur": { "macos.toml": {
				"name": "macOS Big Sur",
				"chords": {}
			} },
			"macOSMonterey": { "macos.toml": {
				"name": "macOS Monterey",
				"chords": {}
			} }
		},
		"Installer-Progress": { "macos.toml": {
			"name": "Installer Progress",
			"chords": {}
		} },
		"JavaLauncher": { "macos.toml": {
			"name": "JavaLauncher",
			"chords": {}
		} },
		"KeyboardAccessAgent": { "macos.toml": {
			"name": "KeyboardAccessAgent",
			"chords": {}
		} },
		"KeyboardSetupAssistant": { "macos.toml": {
			"name": "KeyboardSetupAssistant",
			"chords": {}
		} },
		"Keynote": { "macos.toml": {
			"name": "Keynote: Design Presentations",
			"chords": {}
		} },
		"Language-Chooser": { "macos.toml": {
			"name": "Language Chooser",
			"chords": {}
		} },
		"MDMMigrationTrampoline": { "macos.toml": {
			"name": "MDMMigrationTrampoline",
			"chords": {}
		} },
		"MRT": { "macos.toml": {
			"name": "MRT",
			"chords": {}
		} },
		"MTLReplayer": { "macos.toml": {
			"name": "MTLReplayer",
			"chords": {}
		} },
		"Magnifier": { "macos.toml": {
			"name": "Magnifier",
			"chords": {}
		} },
		"ManagedClient": { "macos.toml": {
			"name": "ManagedClient",
			"chords": {}
		} },
		"Maps": { "macos.toml": {
			"name": "Maps",
			"chords": {}
		} },
		"MediaRemoteUI": { "macos.toml": {
			"name": "MediaRemoteUI",
			"chords": {}
		} },
		"MediaRemoteUIService": { "macos.toml": {
			"name": "MediaRemoteUIService",
			"chords": {}
		} },
		"MedicalImagingCalibrator": { "macos.toml": {
			"name": "Medical Imaging Calibrator",
			"chords": {}
		} },
		"MemorySlotUtility": { "macos.toml": {
			"name": "Memory Slot Utility",
			"chords": {}
		} },
		"MenuBarAgent": { "macos.toml": {
			"name": "MenuBarAgent",
			"chords": {}
		} },
		"MigrateAssistant": { "macos.toml": {
			"name": "Migration Assistant",
			"chords": {}
		} },
		"MobileSMS": { "macos.toml": {
			"name": "Messages",
			"chords": {}
		} },
		"Music": { "macos.toml": {
			"name": "Music",
			"chords": {}
		} },
		"NetAuthAgent": { "macos.toml": {
			"name": "NetAuthAgent",
			"chords": {}
		} },
		"NewDeviceOutreachApp": { "macos.toml": {
			"name": "Coverage Details",
			"chords": {}
		} },
		"Notes": { "macos.toml": {
			"name": "Notes",
			"chords": {}
		} },
		"NowPlayingTouchUI": { "macos.toml": {
			"name": "NowPlayingTouchUI",
			"chords": {}
		} },
		"Numbers": { "macos.toml": {
			"name": "Numbers: Make Spreadsheets",
			"chords": {}
		} },
		"OAHSoftwareUpdateApp": { "macos.toml": {
			"name": "Rosetta 2 Updater",
			"chords": {}
		} },
		"OBEXAgent": { "macos.toml": {
			"name": "OBEXAgent",
			"chords": {}
		} },
		"OSDUIHelper": { "macos.toml": {
			"name": "OSDUIHelper",
			"chords": {}
		} },
		"PIPAgent": { "macos.toml": {
			"name": "PIPAgent",
			"chords": {}
		} },
		"PackageUIKit": { "Install-in-Progress": { "macos.toml": {
			"name": "Install in Progress",
			"chords": {}
		} } },
		"Pages": { "macos.toml": {
			"name": "Pages: Create Documents",
			"chords": {}
		} },
		"PairedDevices": { "macos.toml": {
			"name": "Paired Devices",
			"chords": {}
		} },
		"Pass-Viewer": { "macos.toml": {
			"name": "Pass Viewer",
			"chords": {}
		} },
		"PassViewer": { "macos.toml": {
			"name": "PassViewer",
			"chords": {}
		} },
		"Passwords": { "macos.toml": {
			"name": "Passwords",
			"chords": {}
		} },
		"PeopleMessageService": { "macos.toml": {
			"name": "PeopleMessageService",
			"chords": {}
		} },
		"PeopleViewService": { "macos.toml": {
			"name": "PeopleViewService",
			"chords": {}
		} },
		"PhotoBooth": { "macos.toml": {
			"name": "Photo Booth",
			"chords": {}
		} },
		"Photos": { "macos.toml": {
			"name": "Photos",
			"chords": {}
		} },
		"PlaygroundsMac": { "macos.toml": {
			"name": "Swift Playground",
			"chords": {}
		} },
		"PowerChime": { "macos.toml": {
			"name": "PowerChime",
			"chords": {}
		} },
		"Preview": { "macos.toml": {
			"name": "Preview",
			"chords": {}
		} },
		"PreviewShell": { "macos.toml": {
			"name": "PreviewShell",
			"chords": {}
		} },
		"PreviewShellMac": { "macos.toml": {
			"name": "PreviewShellMac",
			"chords": {}
		} },
		"ProblemReporter": { "macos.toml": {
			"name": "Problem Reporter",
			"chords": {}
		} },
		"QuickTimePlayerX": { "macos.toml": {
			"name": "QuickTime Player",
			"chords": {}
		} },
		"RapportUIAgent": { "macos.toml": {
			"name": "RapportUIAgent",
			"chords": {}
		} },
		"RealityComposerPro": { "macos.toml": {
			"name": "Reality Composer Pro",
			"chords": {}
		} },
		"RemoteDesktop": { "macos.toml": {
			"name": "Apple Remote Desktop",
			"chords": {}
		} },
		"Safari": { "macos.toml": {
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
		} },
		"ScreenContinuity": { "macos.toml": {
			"name": "iPhone Mirroring",
			"on": {
				"tap": { "file": "screen-continuity.js" },
				"hover": {
					"file": "screen-continuity.js",
					"args": ["HOVER"]
				}
			},
			"chords": {
				"?t": { "name": "Tap" },
				"t(.+)": {
					"name": "Tap",
					"@input:tap": ["$1"]
				},
				"?h": { "name": "Hover" },
				"h(.+)": {
					"name": "Hover",
					"@input:hover": ["$1"]
				},
				"?g": { "name": "Goto" },
				"gh": {
					"name": "Goto: Home Screen",
					"shortcut": "cmd+1"
				},
				"ga": {
					"name": "Goto: App Switcher",
					"shortcut": "cmd+2"
				},
				"gs": {
					"name": "Goto: Spotlight",
					"shortcut": "cmd+3"
				},
				"gc": {
					"name": "Goto: Command Centre",
					"shortcut": "cmd+4"
				},
				"?s": { "name": "Size" },
				"s=": {
					"name": "Size: Increase (Zoom)",
					"shortcut": "cmd+="
				},
				"s-": {
					"name": "Size: Decrease (Zoom)",
					"shortcut": "cmd+-"
				},
				"s0": {
					"name": "Size: Actual",
					"shortcut": "cmd+0"
				},
				"si": {
					"name": "Size: iPhone",
					"shortcut": "cmd+9"
				}
			}
		} },
		"ScreenSaver": { "Engine": { "macos.toml": {
			"name": "ScreenSaverEngine",
			"chords": {}
		} } },
		"ScreenSharing": { "macos.toml": {
			"name": "Screen Sharing",
			"chords": {}
		} },
		"ScreenTimeWidgetApplication": { "macos.toml": {
			"name": "Screen Time",
			"chords": {}
		} },
		"ScriptEditor2": { "macos.toml": {
			"name": "Script Editor",
			"chords": {}
		} },
		"ScriptMenuApp": { "macos.toml": {
			"name": "Script Menu",
			"chords": {}
		} },
		"ScriptMonitor": { "macos.toml": {
			"name": "ScriptMonitor",
			"chords": {}
		} },
		"Settings": { "macos.toml": {
			"name": "SettingsPlaceholder",
			"chords": {}
		} },
		"SetupAssistant": { "macos.toml": {
			"name": "Setup Assistant",
			"chords": {}
		} },
		"Sharing": { "AirDropUI": { "macos.toml": {
			"name": "AirDropUI",
			"chords": {}
		} } },
		"ShortcutsActions": { "macos.toml": {
			"name": "ShortcutsActions",
			"chords": {}
		} },
		"SoftwareUpdate": { "macos.toml": {
			"name": "Software Update",
			"chords": {}
		} },
		"SpacesTouchBarAgent": { "macos.toml": {
			"name": "SpacesTouchBarAgent",
			"chords": {}
		} },
		"Spotlight": { "macos.toml": {
			"name": "Spotlight",
			"chords": {}
		} },
		"Stickies": { "macos.toml": {
			"name": "Stickies",
			"chords": {}
		} },
		"SystemIntents": { "macos.toml": {
			"name": "SystemIntents",
			"chords": {}
		} },
		"SystemProfiler": { "macos.toml": {
			"name": "System Information",
			"chords": {}
		} },
		"TV": { "macos.toml": {
			"name": "TV",
			"chords": {}
		} },
		"Terminal": { "macos.toml": {
			"name": "Terminal",
			"chords": {
				"?t": { "name": "Terminal" },
				"t1": {
					"name": "Tab 1",
					"shortcut": "cmd+1"
				},
				"t2": {
					"name": "Tab 2",
					"shortcut": "cmd+2"
				},
				"t3": {
					"name": "Tab 3",
					"shortcut": "cmd+3"
				},
				"t4": {
					"name": "Tab 4",
					"shortcut": "cmd+4"
				},
				"t5": {
					"name": "Tab 5",
					"shortcut": "cmd+5"
				},
				"t6": {
					"name": "Tab 6",
					"shortcut": "cmd+6"
				},
				"t7": {
					"name": "Tab 7",
					"shortcut": "cmd+7"
				},
				"t8": {
					"name": "Tab 8",
					"shortcut": "cmd+8"
				},
				"t9": {
					"name": "Tab 9",
					"shortcut": "cmd+9"
				}
			}
		} },
		"TestFlight": { "macos.toml": {
			"name": "TestFlight",
			"chords": {}
		} },
		"TextEdit": { "macos.toml": {
			"name": "TextEdit",
			"chords": {}
		} },
		"TextInputMenuAgent": { "macos.toml": {
			"name": "TextInputMenuAgent",
			"chords": {}
		} },
		"TextInputSwitcher": { "macos.toml": {
			"name": "TextInputSwitcher",
			"chords": {}
		} },
		"ThermalTrap": { "macos.toml": {
			"name": "ThermalTrap",
			"chords": {}
		} },
		"Ticket-Viewer": { "macos.toml": {
			"name": "Ticket Viewer",
			"chords": {}
		} },
		"TransporterApp": { "macos.toml": {
			"name": "Transporter",
			"chords": {}
		} },
		"UIKitSystemApp": { "macos.toml": {
			"name": "UIKitSystem",
			"chords": {}
		} },
		"UniversalAccessControl": { "macos.toml": {
			"name": "UniversalAccessControl",
			"chords": {}
		} },
		"UnmountAssistantAgent": { "macos.toml": {
			"name": "UnmountAssistantAgent",
			"chords": {}
		} },
		"UserNotificationCenter": { "macos.toml": {
			"name": "UserNotificationCenter",
			"chords": {}
		} },
		"VoiceMemos": { "macos.toml": {
			"name": "Voice Memos",
			"chords": {}
		} },
		"VoiceOver": { "macos.toml": {
			"name": "VoiceOver",
			"chords": {}
		} },
		"VoiceOverUtility": { "macos.toml": {
			"name": "VoiceOver Utility",
			"chords": {}
		} },
		"WatchFaceAlert": { "macos.toml": {
			"name": "WatchFaceAlert",
			"chords": {}
		} },
		"WorkoutAlert-Mac": { "macos.toml": {
			"name": "WorkoutAlert-Mac",
			"chords": {}
		} },
		"XProtectFramework": { "XProtect": { "macos.toml": {
			"name": "XProtect",
			"chords": {}
		} } },
		"accessibility": { "AccessibilityReader": { "macos.toml": {
			"name": "Accessibility Reader",
			"chords": {}
		} } },
		"airport": { "airportutility": { "macos.toml": {
			"name": "AirPort Utility",
			"chords": {}
		} } },
		"appleseed": { "FeedbackAssistant": { "macos.toml": {
			"name": "Feedback Assistant",
			"chords": {}
		} } },
		"apps": { "launcher": { "macos.toml": {
			"name": "Apps",
			"chords": {}
		} } },
		"archiveutility": { "macos.toml": {
			"name": "Archive Utility",
			"chords": {}
		} },
		"audio": { "AudioMIDISetup": { "macos.toml": {
			"name": "Audio MIDI Setup",
			"chords": {}
		} } },
		"backup": { "launcher": { "macos.toml": {
			"name": "Time Machine",
			"chords": {}
		} } },
		"business-essentials": { "macos.toml": {
			"name": "Apple Business",
			"chords": {}
		} },
		"calculator": { "macos.toml": {
			"name": "Calculator",
			"chords": {}
		} },
		"campo": { "macos.toml": {
			"name": "Siri AI",
			"chords": {}
		} },
		"chrono": { "WidgetRenderer-Activities": { "macos.toml": {
			"name": "WidgetRenderer_Activities",
			"chords": {}
		} } },
		"clock": { "macos.toml": {
			"name": "Clock",
			"chords": {}
		} },
		"configurator": { "ui": { "macos.toml": {
			"name": "Apple Configurator",
			"chords": {}
		} } },
		"controlcenter": { "macos.toml": {
			"name": "ControlCenter",
			"chords": {}
		} },
		"controlstrip": { "macos.toml": {
			"name": "ControlStrip",
			"chords": {}
		} },
		"coreservices": { "uiagent": { "macos.toml": {
			"name": "CoreServicesUIAgent",
			"chords": {}
		} } },
		"databaseevents": { "macos.toml": {
			"name": "Database Events",
			"chords": {}
		} },
		"displaycalibrator": { "macos.toml": {
			"name": "Pro Display Calibrator",
			"chords": {}
		} },
		"dock": { "macos.toml": {
			"name": "Dock",
			"chords": {}
		} },
		"dt": {
			"CommandLineTools": { "installondemand": { "macos.toml": {
				"name": "Install Command Line Developer Tools",
				"chords": {}
			} } },
			"Instruments": { "macos.toml": {
				"name": "Instruments",
				"chords": {}
			} },
			"Xcode": { "macos.toml": {
				"name": "Xcode",
				"chords": {}
			} }
		},
		"exposelauncher": { "macos.toml": {
			"name": "Mission Control",
			"chords": {}
		} },
		"findmy": { "macos.toml": {
			"name": "Find My",
			"chords": {}
		} },
		"freeform": { "macos.toml": {
			"name": "Freeform",
			"chords": {}
		} },
		"gamecenter": { "macos.toml": {
			"name": "Game Center",
			"chords": {}
		} },
		"games": { "macos.toml": {
			"name": "Games",
			"chords": {}
		} },
		"garageband10": { "macos.toml": {
			"name": "GarageBand",
			"chords": {}
		} },
		"grapher": { "macos.toml": {
			"name": "Grapher",
			"chords": {}
		} },
		"helpviewer": { "macos.toml": {
			"name": "Tips",
			"chords": {}
		} },
		"iBooksX": { "macos.toml": {
			"name": "Books",
			"chords": {}
		} },
		"iCal": { "macos.toml": {
			"name": "Calendar",
			"chords": {}
		} },
		"iMovieApp": { "macos.toml": {
			"name": "iMovie",
			"chords": {}
		} },
		"iWork": {
			"Keynote": { "macos.toml": {
				"name": "Keynote",
				"chords": {}
			} },
			"Numbers": { "macos.toml": {
				"name": "Numbers",
				"chords": {}
			} },
			"Pages": { "macos.toml": {
				"name": "Pages",
				"chords": {}
			} }
		},
		"icq": { "macos.toml": {
			"name": "iCloud+",
			"chords": {}
		} },
		"imageevents": { "macos.toml": {
			"name": "Image Events",
			"chords": {}
		} },
		"installer": { "macos.toml": {
			"name": "Installer",
			"chords": {}
		} },
		"journal": { "macos.toml": {
			"name": "Journal",
			"chords": {}
		} },
		"keychainaccess": { "macos.toml": {
			"name": "Keychain Access",
			"chords": {}
		} },
		"logic10": { "macos.toml": {
			"name": "Logic Pro",
			"chords": {}
		} },
		"loginwindow": { "macos.toml": {
			"name": "loginwindow",
			"chords": {}
		} },
		"macos": { "classroom": { "macos.toml": {
			"name": "Classroom",
			"chords": {}
		} } },
		"mail": { "macos.toml": {
			"name": "Mail",
			"chords": {}
		} },
		"mainstage3": { "macos.toml": {
			"name": "MainStage",
			"chords": {}
		} },
		"mcx": { "ProfileHelper": { "macos.toml": {
			"name": "ProfileHelper",
			"chords": {}
		} } },
		"mobilephone": { "macos.toml": {
			"name": "Phone",
			"chords": {}
		} },
		"motionapp": { "macos.toml": {
			"name": "Motion",
			"chords": {}
		} },
		"motionappApp": { "macos.toml": {
			"name": "Motion: Animate Effects",
			"chords": {}
		} },
		"musicrecognition": { "mac": { "macos.toml": {
			"name": "MusicRecognitionMac",
			"chords": {}
		} } },
		"news": { "macos.toml": {
			"name": "News",
			"chords": {}
		} },
		"notificationcenterui": { "macos.toml": {
			"name": "NotificationCenter",
			"chords": {}
		} },
		"pixelmator": { "macos.toml": {
			"name": "Pixelmator Pro: Edit Images",
			"chords": {}
		} },
		"pluginIM": { "pluginIMRegistrator": { "macos.toml": {
			"name": "RegisterPluginIMApp",
			"chords": {}
		} } },
		"podcasts": { "macos.toml": {
			"name": "Podcasts",
			"chords": {}
		} },
		"print": { "add": { "macos.toml": {
			"name": "AddPrinter",
			"chords": {}
		} } },
		"printcenter": { "macos.toml": {
			"name": "Print Center",
			"chords": {}
		} },
		"rcd": { "macos.toml": {
			"name": "rcd",
			"chords": {}
		} },
		"reminders": { "macos.toml": {
			"name": "Reminders",
			"chords": {}
		} },
		"screencaptureui": { "macos.toml": {
			"name": "screencaptureui",
			"chords": {}
		} },
		"screenshot": { "launcher": { "macos.toml": {
			"name": "Screenshot",
			"chords": {}
		} } },
		"security": { "Keychain-Circle-Notification": { "macos.toml": {
			"name": "Keychain Circle Notification",
			"chords": {}
		} } },
		"shortcuts": {
			"droplet": { "macos.toml": {
				"name": "ShortcutDroplet",
				"chords": {}
			} },
			"events": { "macos.toml": {
				"name": "Shortcuts Events",
				"chords": {}
			} },
			"macos.toml": {
				"name": "Shortcuts",
				"chords": {}
			}
		},
		"siri": {
			"launcher": { "macos.toml": {
				"name": "Siri",
				"chords": {}
			} },
			"macos.toml": {
				"name": "Siri",
				"chords": {}
			}
		},
		"stocks": { "macos.toml": {
			"name": "Stocks",
			"chords": {}
		} },
		"systemevents": { "macos.toml": {
			"name": "System Events",
			"chords": {}
		} },
		"systempreferences": { "macos.toml": {
			"name": "System Preferences",
			"on": { "appearance": { "file": "systempreferences.js" } },
			"chords": {
				"?g": { "name": "Goto" },
				"gaa": {
					"name": "Goto: Apple Account",
					"shell": "open 'x-apple.systempreferences:com.apple.systempreferences.AppleIDSettings'"
				},
				"gwi": {
					"name": "Goto: Wi-fi",
					"shell": "open 'x-apple.systempreferences:com.apple.wifi-settings-extension'"
				},
				"gbl": {
					"name": "Goto: Bluetooth",
					"shell": "open 'x-apple.systempreferences:com.apple.BluetoothSettings'"
				},
				"gne": {
					"name": "Goto: Network",
					"shell": "open 'x-apple.systempreferences:com.apple.Network-Settings.extension'"
				},
				"gvp": {
					"name": "Goto: VPN",
					"shell": "open 'x-apple.systempreferences:com.apple.NetworkExtensionSettingsUI.NESettingsUIExtension'"
				},
				"gba": {
					"name": "Goto: Battery",
					"shell": "open 'x-apple.systempreferences:com.apple.Battery-Settings.extension'"
				},
				"gge": {
					"name": "Goto: General",
					"shell": "open 'x-apple.systempreferences:com.apple.systempreferences.GeneralSettings'"
				},
				"gac": {
					"name": "Goto: Accessibility",
					"shell": "open 'x-apple.systempreferences:com.apple.Accessibility-Settings.extension'"
				},
				"gap": {
					"name": "Goto: Appearance",
					"shell": "open 'x-apple.systempreferences:com.apple.Appearance-Settings.extension'"
				},
				"gai": {
					"name": "Goto: Apple Intelligence",
					"shell": "open 'x-apple.systempreferences:com.apple.Siri-Settings.extension'"
				},
				"gdd": {
					"name": "Goto: Desktop & Dock",
					"shell": "open 'x-apple.systempreferences:com.apple.Desktop-Settings.extension'"
				},
				"gdi": {
					"name": "Goto: Displays",
					"shell": "open 'x-apple.systempreferences:com.apple.Displays-Settings.extension'"
				},
				"gmb": {
					"name": "Goto: Menu Bar",
					"shell": "open 'x-apple.systempreferences:com.apple.ControlCenter-Settings.extension'"
				},
				"gsp": {
					"name": "Goto: Spotlight",
					"shell": "open 'x-apple.systempreferences:com.apple.Spotlight-Settings.extension'"
				},
				"gwa": {
					"name": "Goto: Wallpaper",
					"shell": "open 'x-apple.systempreferences:com.apple.Wallpaper-Settings.extension'"
				},
				"gno": {
					"name": "Goto: Notifications",
					"shell": "open 'x-apple.systempreferences:com.apple.Notifications-Settings.extension'"
				},
				"gso": {
					"name": "Goto: Sound",
					"shell": "open 'x-apple.systempreferences:com.apple.Sound-Settings.extension'"
				},
				"gfo": {
					"name": "Goto: Focus",
					"shell": "open 'x-apple.systempreferences:com.apple.Focus-Settings.extension'"
				},
				"gst": {
					"name": "Goto: Screen Time",
					"shell": "open 'x-apple.systempreferences:com.apple.Screen-Time-Settings.extension'"
				},
				"gls": {
					"name": "Goto: Lock Screen",
					"shell": "open 'x-apple.systempreferences:com.apple.Lock-Screen-Settings.extension'"
				},
				"gps": {
					"name": "Goto: Privacy & Security",
					"shell": "open 'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension'"
				},
				"gtp": {
					"name": "Goto: Touch ID & Password",
					"shell": "open 'x-apple.systempreferences:com.apple.Touch-ID-Settings.extension'"
				},
				"gup": {
					"name": "Goto: Users & Groups",
					"shell": "open 'x-apple.systempreferences:com.apple.Users-Groups-Settings.extension'"
				},
				"gia": {
					"name": "Goto: Internet Accounts",
					"shell": "open 'x-apple.systempreferences:com.apple.Internet-Accounts-Settings.extension'"
				},
				"ggc": {
					"name": "Goto: Game Center",
					"shell": "open 'x-apple.systempreferences:com.apple.Game-Center-Settings.extension'"
				},
				"gic": {
					"name": "Goto: iCloud",
					"shell": "open 'x-apple.systempreferences:com.apple.systempreferences.AppleIDSettings:icloud'"
				},
				"gwp": {
					"name": "Goto: Wallet & (Apple) Pay",
					"shell": "open 'x-apple.systempreferences:com.apple.WalletSettingsExtension'"
				},
				"gke": {
					"name": "Goto: Keyboard",
					"shell": "open 'x-apple.systempreferences:com.apple.Keyboard-Settings.extension'"
				},
				"gtr": {
					"name": "Goto: Trackpad",
					"shell": "open 'x-apple.systempreferences:com.apple.Trackpad-Settings.extension'"
				},
				"gpr": {
					"name": "Goto: Printers",
					"shell": "open 'x-apple.systempreferences:com.apple.Print-Scan-Settings.extension'"
				},
				"?ap": { "name": "Appearance" },
				"apa": {
					"name": "Appearance: Auto",
					"@input:appearance": ["AUTO"]
				},
				"apd": {
					"name": "Appearance: Dark",
					"@input:appearance": ["DARK"]
				},
				"apl": {
					"name": "Appearance: Light",
					"@input:appearance": ["LIGHT"]
				}
			}
		} },
		"systemuiserver": { "macos.toml": {
			"name": "SystemUIServer",
			"chords": {}
		} },
		"tcc": { "AuthorizationPromptService": { "macos.toml": {
			"name": "AuthorizationPromptService",
			"chords": {}
		} } },
		"tips": { "macos.toml": {
			"name": "TipsSpotlightHandler",
			"chords": {}
		} },
		"universalcontrol": { "macos.toml": {
			"name": "UniversalControl",
			"chords": {}
		} },
		"wallpaper": { "agent": { "macos.toml": {
			"name": "WallpaperAgent",
			"chords": {}
		} } },
		"weather": { "macos.toml": {
			"name": "Weather",
			"chords": {}
		} },
		"widgetkit": { "simulator": { "macos.toml": {
			"name": "WidgetKit Simulator",
			"chords": {}
		} } },
		"wifi": {
			"WiFiAgent": { "macos.toml": {
				"name": "WiFiAgent",
				"chords": {}
			} },
			"diagnostics": { "macos.toml": {
				"name": "Wireless Diagnostics",
				"chords": {}
			} }
		},
		"windowmanager": {
			"StageManagerOnboarding": { "macos.toml": {
				"name": "StageManagerOnboarding",
				"chords": {}
			} },
			"macos.toml": {
				"name": "WindowManager",
				"chords": {}
			}
		}
	} },
	"macos.toml": {
		"name": "macOS",
		"chords": {
			"/b": {
				"name": "Browser (Safari)",
				"shell": "open -a Safari"
			},
			"/t": {
				"name": "Terminal",
				"shell": "open -a Terminal"
			},
			"/ai": { "name": "Accessibility Inspector" },
			"/am": {
				"name": "Activity Monitor",
				"shell": "open -a 'Activity Monitor'"
			},
			"/,": {
				"name": "System Preferences",
				"shell": "open -b com.apple.systempreferences"
			}
		}
	}
};
var package_default = {
	name,
	version,
	repository,
	type,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { chords, package_default as default, dependencies, devDependencies, name, packageManager, repository, type, version };
