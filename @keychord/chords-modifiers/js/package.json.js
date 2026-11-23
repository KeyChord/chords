// package.json
var name = "@keychord/chords-modifiers";
var displayName = "Modifier Chords";
var version = "0.0.2";
var description = "Global chords that press a keyboard shortcut in whichever app is focused.";
var categories = ["Input"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-modifiers"
};
var type = "module";
var exports = { ".": "./src/js/keys.ts" };
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
		"name": "Modifier Keys",
		"meta": { "chord": ">=0.3.4" },
		"on": { "keys": { "file": "keys.js" } },
		"placeholders": { "<>": {
			"name": "Modifier keys prefix",
			"default": "k"
		} },
		"chords": {
			"?<>": { "name": "Modifiers" },
			"?<>m": { "name": "Super" },
			"<>(m.[acms]*)": {
				"name": "Super Combo",
				"@input:keys": ["$1"]
			},
			"?<>c": { "name": "Control" },
			"<>(c.[acms]*)": {
				"name": "Control Combo",
				"@input:keys": ["$1"]
			},
			"?<>a": { "name": "Alt" },
			"<>(a.[acms]*)": {
				"name": "Alt Combo",
				"@input:keys": ["$1"]
			},
			"?<>s": { "name": "Shift" },
			"<>(s.[acms]*)": {
				"name": "Shift Combo",
				"@input:keys": ["$1"]
			}
		}
	},
	"macos.toml": {
		"name": "Modifier Keys",
		"meta": { "chord": ">=0.3.0" },
		"on": { "keys": { "file": "keys.js" } },
		"placeholders": { "<>": {
			"name": "Modifier keys prefix",
			"default": "k"
		} },
		"chords": {
			"?<>": { "name": "Modifiers" },
			"?<>m": { "name": "Meta (Command)" },
			"<>(m.[acfms]*)": {
				"name": "Meta (Cmd) Combo",
				"@input:keys": ["$1"]
			},
			"?<>c": { "name": "Control" },
			"<>(c.[acfms]*)": {
				"name": "Control Combo",
				"@input:keys": ["$1"]
			},
			"?<>a": { "name": "Alt (Option)" },
			"<>(a.[acfms]*)": {
				"name": "Alt Combo",
				"@input:keys": ["$1"]
			},
			"?<>f": { "name": "Fn" },
			"<>(f.[acfms]*)": {
				"name": "Fn Combo",
				"@input:keys": ["$1"]
			},
			"?<>s": { "name": "Shift" },
			"<>(s.[acfms]*)": {
				"name": "Shift Combo",
				"@input:keys": ["$1"]
			}
		}
	},
	"windows.toml": {
		"name": "Modifier Keys",
		"meta": { "chord": ">=0.3.4" },
		"on": { "keys": { "file": "keys.js" } },
		"placeholders": { "<>": {
			"name": "Modifier keys prefix",
			"default": "k"
		} },
		"chords": {
			"?<>": { "name": "Modifiers" },
			"?<>m": { "name": "Windows" },
			"<>(m.[acms]*)": {
				"name": "Windows Key Combo",
				"@input:keys": ["$1"]
			},
			"?<>c": { "name": "Control" },
			"<>(c.[acms]*)": {
				"name": "Control Combo",
				"@input:keys": ["$1"]
			},
			"?<>a": { "name": "Alt" },
			"<>(a.[acms]*)": {
				"name": "Alt Combo",
				"@input:keys": ["$1"]
			},
			"?<>s": { "name": "Shift" },
			"<>(s.[acms]*)": {
				"name": "Shift Combo",
				"@input:keys": ["$1"]
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
	exports,
	scripts,
	devDependencies,
	packageManager,
	chords
};
export { categories, chords, package_default as default, description, devDependencies, displayName, exports, name, packageManager, repository, scripts, type, version };
