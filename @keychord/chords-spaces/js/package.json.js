//#region package.json
var name = "@keychord/chords-spaces";
var displayName = "Spaces Chords";
var version = "0.0.2";
var description = "Navigate macOS Spaces, Linux workspaces, and Windows virtual desktops.";
var categories = ["Window Management"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-spaces"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "^1.4.3"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"linux.toml": {
		"name": "Linux Workspaces",
		"meta": { "chord": ">=0.3.4" },
		"on": { "workspace": { "file": "workspace.js" } },
		"placeholders": { "<>": {
			"name": "Desktop prefix",
			"default": "d"
		} },
		"chords": {
			"?<>": { "name": "Workspaces" },
			"<>[": {
				"name": "Workspace: Previous",
				"@input:workspace": ["SWITCH", "PREVIOUS"]
			},
			"<>]": {
				"name": "Workspace: Next",
				"@input:workspace": ["SWITCH", "NEXT"]
			},
			"<>l": {
				"name": "Workspace: Previous",
				"@input:workspace": ["SWITCH", "PREVIOUS"]
			},
			"<>r": {
				"name": "Workspace: Next",
				"@input:workspace": ["SWITCH", "NEXT"]
			},
			"?<>\"1-9\"": { "name": "Workspace: Switch to #" },
			"<>([1-9])": {
				"name": "Workspace: Switch to $1",
				"@input:workspace": ["SWITCH", "$1"]
			},
			"?<>m": { "name": "Move Window to Workspace" },
			"<>m[": {
				"name": "Window: Move to Previous Workspace",
				"@input:workspace": ["MOVE", "PREVIOUS"]
			},
			"<>m]": {
				"name": "Window: Move to Next Workspace",
				"@input:workspace": ["MOVE", "NEXT"]
			},
			"?<>m\"1-9\"": { "name": "Window: Move to Workspace #" },
			"<>m([1-9])": {
				"name": "Window: Move to Workspace $1",
				"@input:workspace": ["MOVE", "$1"]
			}
		}
	},
	"macos.toml": {
		"name": "macOS Spaces",
		"meta": { "chord": ">=0.3.0" },
		"placeholders": { "<>": {
			"name": "Space prefix",
			"default": "s"
		} },
		"on": { "space": { "file": "spaces.js" } },
		"chords": {
			"?<>": { "name": "Spaces" },
			"<>[": {
				"name": "Space: Previous",
				"@input:space": ["PREVIOUS"]
			},
			"<>]": {
				"name": "Space: Next",
				"@input:space": ["NEXT"]
			},
			"<>l": {
				"name": "Space: Left",
				"@input:space": ["PREVIOUS"]
			},
			"<>r": {
				"name": "Space: Right",
				"@input:space": ["NEXT"]
			},
			"<>1": {
				"name": "Space: Desktop 1",
				"@input:space": ["1"]
			},
			"<>2": {
				"name": "Space: Desktop 2",
				"@input:space": ["2"]
			},
			"<>3": {
				"name": "Space: Desktop 3",
				"@input:space": ["3"]
			},
			"<>4": {
				"name": "Space: Desktop 4",
				"@input:space": ["4"]
			},
			"<>5": {
				"name": "Space: Desktop 5",
				"@input:space": ["5"]
			},
			"<>6": {
				"name": "Space: Desktop 6",
				"@input:space": ["6"]
			},
			"<>7": {
				"name": "Space: Desktop 7",
				"@input:space": ["7"]
			},
			"<>8": {
				"name": "Space: Desktop 8",
				"@input:space": ["8"]
			},
			"<>9": {
				"name": "Space: Desktop 9",
				"@input:space": ["9"]
			}
		}
	},
	"windows.toml": {
		"name": "Windows Virtual Desktops",
		"meta": { "chord": ">=0.3.4" },
		"placeholders": { "<>": {
			"name": "Desktop prefix",
			"default": "d"
		} },
		"chords": {
			"?<>": { "name": "Virtual Desktops" },
			"<>[": {
				"name": "Desktop: Previous",
				"shortcut": "super+ctrl+left"
			},
			"<>]": {
				"name": "Desktop: Next",
				"shortcut": "super+ctrl+right"
			},
			"<>l": {
				"name": "Desktop: Previous",
				"shortcut": "super+ctrl+left"
			},
			"<>r": {
				"name": "Desktop: Next",
				"shortcut": "super+ctrl+right"
			},
			"<>v": {
				"name": "Desktop: Open Task View",
				"shortcut": "super+tab"
			},
			"<>n": {
				"name": "Desktop: Create",
				"shortcut": "super+ctrl+d"
			},
			"<>q": {
				"name": "Desktop: Close Current",
				"shortcut": "super+ctrl+f4"
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
