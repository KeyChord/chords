//#region package.json
var name = "@keychord/chords-web";
var displayName = "Web Chords";
var version = "0.0.1";
var description = "Global chords for the active tab in Chrome, Brave, Edge or Arc, such as scrolling.";
var categories = ["Browsers"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-web"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var dependencies = {
	"jquery-as-string": "^0.4.0",
	"outdent": "^0.8.0"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"linux.toml": {
		"name": "Web chords",
		"meta": { "chord": ">=0.3.4" },
		"on": { "scroll": { "file": "web-desktop.js" } },
		"placeholders": { "<>": {
			"name": "Web scrolling prefix",
			"default": "b"
		} },
		"chords": {
			"?<>": { "name": "Web scrolling" },
			"<>n": {
				"name": "Scroll up",
				"@input:scroll": ["NORTH"]
			},
			"<>s": {
				"name": "Scroll down",
				"@input:scroll": ["SOUTH"]
			},
			"<>e": {
				"name": "Scroll right",
				"@input:scroll": ["EAST"]
			},
			"<>w": {
				"name": "Scroll left",
				"@input:scroll": ["WEST"]
			}
		}
	},
	"macos.toml": {
		"name": "Web chords",
		"on": { "js": { "file": "web.js" } },
		"chords": {}
	},
	"windows.toml": {
		"name": "Web chords",
		"meta": { "chord": ">=0.3.4" },
		"on": { "scroll": { "file": "web-desktop.js" } },
		"placeholders": { "<>": {
			"name": "Web scrolling prefix",
			"default": "b"
		} },
		"chords": {
			"?<>": { "name": "Web scrolling" },
			"<>n": {
				"name": "Scroll up",
				"@input:scroll": ["NORTH"]
			},
			"<>s": {
				"name": "Scroll down",
				"@input:scroll": ["SOUTH"]
			},
			"<>e": {
				"name": "Scroll right",
				"@input:scroll": ["EAST"]
			},
			"<>w": {
				"name": "Scroll left",
				"@input:scroll": ["WEST"]
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
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, name, packageManager, repository, scripts, type, version };
