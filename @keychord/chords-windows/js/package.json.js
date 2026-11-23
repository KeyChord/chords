//#region package.json
var name = "@keychord/chords-windows";
var displayName = "Window Chords";
var version = "0.0.2";
var description = "Resize, minimize, hide and quit the focused window or app, or move it to another Space.";
var categories = ["Window Management"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-windows"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"linux.toml": {
		"name": "Linux Window Management",
		"meta": { "chord": ">=0.3.0" },
		"placeholders": { "<>": {
			"name": "Window prefix",
			"default": "w"
		} },
		"chords": {
			"?<>": { "name": "Window" },
			"<>l": {
				"name": "Window: Tile Left",
				"shortcut": "super+left"
			},
			"<>r": {
				"name": "Window: Tile Right",
				"shortcut": "super+right"
			},
			"<>f": {
				"name": "Window: Maximize",
				"shortcut": "super+up"
			},
			"<>u": {
				"name": "Window: Restore",
				"shortcut": "super+down"
			},
			"<>m": {
				"name": "Window: Minimize",
				"shortcut": "super+h"
			},
			"<>q": {
				"name": "Window: Close",
				"shortcut": "alt+f4"
			},
			"<>p": {
				"name": "Window: Move with Arrow Keys",
				"shortcut": "alt+f7"
			},
			"<>d": {
				"name": "Window: Resize with Arrow Keys",
				"shortcut": "alt+f8"
			},
			"<>a": {
				"name": "Window: Open Window Menu",
				"shortcut": "alt+space"
			},
			"<>]": {
				"name": "Window: Switch to Another Window of This App",
				"shortcut": "alt+f6"
			},
			"?<>s": { "name": "Window: Move to Workspace" },
			"<>s1": {
				"name": "Window: Move to First Workspace",
				"shortcut": "super+shift+home"
			},
			"<>s[": {
				"name": "Window: Move to Previous Workspace",
				"shortcut": "super+shift+pageup"
			},
			"<>s]": {
				"name": "Window: Move to Next Workspace",
				"shortcut": "super+shift+pagedown"
			},
			"?<>g": { "name": "Window: Move to Monitor" },
			"<>gl": {
				"name": "Window: Move to Left Monitor",
				"shortcut": "super+shift+left"
			},
			"<>gr": {
				"name": "Window: Move to Right Monitor",
				"shortcut": "super+shift+right"
			},
			"<>gt": {
				"name": "Window: Move to Upper Monitor",
				"shortcut": "super+shift+up"
			},
			"<>gb": {
				"name": "Window: Move to Lower Monitor",
				"shortcut": "super+shift+down"
			}
		}
	},
	"macos.toml": {
		"name": "macOS Windows",
		"meta": { "chord": ">=0.3.0" },
		"on": { "window": { "file": "window.js" } },
		"placeholders": { "<>": {
			"name": "Window prefix",
			"default": "w"
		} },
		"chords": {
			"?<>": { "name": "Window" },
			"<>l": {
				"name": "Window: left",
				"@input:window": ["PRESET", "LEFT"]
			},
			"<>r": {
				"name": "Window: right",
				"@input:window": ["PRESET", "RIGHT"]
			},
			"<>t": {
				"name": "Window: top",
				"@input:window": ["PRESET", "TOP"]
			},
			"<>b": {
				"name": "Window: bottom",
				"@input:window": ["PRESET", "BOTTOM"]
			},
			"<>tl": {
				"name": "Window: top-left",
				"@input:window": ["PRESET", "TOP_LEFT"]
			},
			"<>tr": {
				"name": "Window: top-right",
				"@input:window": ["PRESET", "TOP_RIGHT"]
			},
			"<>bl": {
				"name": "Window: bottom-left",
				"@input:window": ["PRESET", "BOTTOM_LEFT"]
			},
			"<>br": {
				"name": "Window: bottom-right",
				"@input:window": ["PRESET", "BOTTOM_RIGHT"]
			},
			"<>lr": {
				"name": "Window: horizontal",
				"@input:window": ["PRESET", "HORIZONTAL"]
			},
			"<>rl": {
				"name": "Window: horizontal",
				"@input:window": ["PRESET", "HORIZONTAL"]
			},
			"<>tb": {
				"name": "Window: vertical",
				"@input:window": ["PRESET", "VERTICAL"]
			},
			"<>bt": {
				"name": "Window: vertical",
				"@input:window": ["PRESET", "VERTICAL"]
			},
			"<>f": {
				"name": "Window: fill",
				"@input:window": ["PRESET", "FILL"]
			},
			"<>c": {
				"name": "Window: center",
				"@input:window": ["PRESET", "CENTER"]
			},
			"?<>px": { "name": "Window: Position, X" },
			"<>px(.+)": {
				"name": "Window: Position, X (Set)",
				"@input:window": [
					"POSITION",
					"$1",
					"X"
				]
			},
			"?<>py": { "name": "Window: Position, Y" },
			"<>py(.+)": {
				"name": "Window: Position, Y (Set)",
				"@input:window": [
					"POSITION",
					"$1",
					"Y"
				]
			},
			"?<>p": { "name": "Window: Position" },
			"<>p([^xy].*)": {
				"name": "Window: Position (Set)",
				"@input:window": ["POSITION", "$1"]
			},
			"?<>dw": { "name": "Window: Dimensions, Width" },
			"<>dw([^=-].*)": {
				"name": "Window: Dimensions, Width (Set)",
				"@input:window": [
					"DIMENSIONS",
					"$1",
					"WIDTH"
				]
			},
			"?<>dw=": { "name": "Window: Dimensions, Width (Increase)" },
			"<>dw=([0-9]?)": {
				"name": "Window: Dimensions, Width (Increase)",
				"@input:window": [
					"DIMENSIONS_INCREASE",
					"$1",
					"WIDTH"
				]
			},
			"?<>dw-": { "name": "Window: Dimensions, Width (Decrease)" },
			"<>dw-([0-9]?)": {
				"name": "Window: Dimensions, Width (Decrease)",
				"@input:window": [
					"DIMENSIONS_DECREASE",
					"$1",
					"WIDTH"
				]
			},
			"?<>dh": { "name": "Window: Dimensions, Height" },
			"<>dh([^=-].*)": {
				"name": "Window: Dimensions, Height (Set)",
				"@input:window": [
					"DIMENSIONS",
					"$1",
					"HEIGHT"
				]
			},
			"?<>dh=": { "name": "Window: Dimensions, Height (Increase)" },
			"<>dh=([0-9]?)": {
				"name": "Window: Dimensions, Height (Increase)",
				"@input:window": [
					"DIMENSIONS_INCREASE",
					"$1",
					"HEIGHT"
				]
			},
			"?<>dh-": { "name": "Window: Dimensions, Height (Decrease)" },
			"<>dh-([0-9]?)": {
				"name": "Window: Dimensions, Height (Decrease)",
				"@input:window": [
					"DIMENSIONS_DECREASE",
					"$1",
					"HEIGHT"
				]
			},
			"?<>d": { "name": "Window: Dimensions" },
			"<>d([^wh=-].*)": {
				"name": "Window: Dimensions (Set)",
				"@input:window": ["DIMENSIONS", "$1"]
			},
			"?<>d=": { "name": "Window: Dimensions (Increase)" },
			"<>d=([0-9]?)": {
				"name": "Window: Dimensions (Increase)",
				"@input:window": ["DIMENSIONS_INCREASE", "$1"]
			},
			"?<>d-": { "name": "Window: Dimensions (Decrease)" },
			"<>d-([0-9]?)": {
				"name": "Window: Dimensions (Decrease)",
				"@input:window": ["DIMENSIONS_DECREASE", "$1"]
			},
			"<>([0-9\\s-]+)": {
				"name": "Window: Dimensions + Position",
				"@input:window": ["FRAME", "$1"]
			},
			"?<>s": { "name": "Window: Space" },
			"<>s(\\d+)": {
				"name": "Window: Space $1 (Move)",
				"@input:window": ["SPACE", "$1"]
			},
			"<>s]": {
				"name": "Window: Space (Next)",
				"@input:window": ["SPACE", "NEXT"]
			},
			"<>s[": {
				"name": "Window: Space (Previous)",
				"@input:window": ["SPACE", "PREVIOUS"]
			},
			"<>h": {
				"name": "Window: Hide",
				"shortcut": "cmd+h"
			},
			"<>m": {
				"name": "Window: Minimize",
				"shortcut": "cmd+m"
			},
			"<>q": {
				"name": "Window: Quit",
				"shortcut": "cmd+q"
			},
			"<>[": {
				"name": "Window: Previous",
				"@input:window": ["CYCLE", "PREVIOUS"]
			},
			"<>]": {
				"name": "Window: Next",
				"@input:window": ["CYCLE", "NEXT"]
			}
		}
	},
	"windows.toml": {
		"name": "Windows Window Management",
		"meta": { "chord": ">=0.3.0" },
		"placeholders": { "<>": {
			"name": "Window prefix",
			"default": "w"
		} },
		"chords": {
			"?<>": { "name": "Window" },
			"<>l": {
				"name": "Window: Snap Left",
				"shortcut": "super+left"
			},
			"<>r": {
				"name": "Window: Snap Right",
				"shortcut": "super+right"
			},
			"<>t": {
				"name": "Window: Snap Top",
				"shortcut": "super+alt+up"
			},
			"<>b": {
				"name": "Window: Snap Bottom",
				"shortcut": "super+alt+down"
			},
			"<>f": {
				"name": "Window: Maximize",
				"shortcut": "super+up"
			},
			"<>tb": {
				"name": "Window: Stretch Vertically",
				"shortcut": "super+shift+up"
			},
			"<>bt": {
				"name": "Window: Stretch Vertically",
				"shortcut": "super+shift+up"
			},
			"<>u": {
				"name": "Window: Restore",
				"shortcut": "super+shift+down"
			},
			"<>m": {
				"name": "Window: Restore or Minimize",
				"shortcut": "super+down"
			},
			"<>q": {
				"name": "Window: Close",
				"shortcut": "alt+f4"
			},
			"<>a": {
				"name": "Window: Open Window Menu",
				"shortcut": "alt+space"
			},
			"<>z": {
				"name": "Window: Show Snap Layouts",
				"shortcut": "super+z"
			},
			"<>[": {
				"name": "Window: Switch Backward",
				"shortcut": "alt+shift+tab"
			},
			"<>]": {
				"name": "Window: Switch Forward",
				"shortcut": "alt+tab"
			},
			"?<>g": { "name": "Window: Move to Monitor" },
			"<>gl": {
				"name": "Window: Move to Left Monitor",
				"shortcut": "super+shift+left"
			},
			"<>gr": {
				"name": "Window: Move to Right Monitor",
				"shortcut": "super+shift+right"
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
