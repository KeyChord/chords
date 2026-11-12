//#region package.json
var name = "@keychord/chords-raycast";
var displayName = "Raycast Chords";
var version = "0.0.0";
var description = "Chords for Raycast: open a query's first result and move through results, pages and sections.";
var categories = ["Utilities"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-raycast"
};
var type = "module";
var imports = { "#/*": "./src/js/*" };
var scripts = { "test": "bun test --isolate" };
var dependencies = {
	"array-uniq": "latest",
	"brace-expansion": "latest",
	"js-yaml": "latest",
	"just-zip-it": "latest"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest",
	"@types/js-yaml": "latest",
	"@types/node": "26.6.5"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"com": { "raycast": { "macos": { "macos.toml": {
		"name": "Raycast",
		"meta": { "url": "https://manual.raycast.com/keyboard-shortcuts" },
		"chords": {
			"nn": {
				"name": "Navigate: North",
				"shortcut": "up"
			},
			"ne": {
				"name": "Navigate: East",
				"shortcut": "right"
			},
			"ns": {
				"name": "Navigate: South",
				"shortcut": "down"
			},
			"nw": {
				"name": "Navigate: West",
				"shortcut": "left"
			},
			"p[": {
				"name": "Page: Previous",
				"shortcut": "alt+up"
			},
			"p]": {
				"name": "Page: Next",
				"shortcut": "alt+down"
			},
			"s[": {
				"name": "Section: Previous",
				"shortcut": "cmd+up"
			},
			"s]": {
				"name": "Section: Next",
				"shortcut": "cmd+down"
			}
		}
	} } } },
	"macos.toml": {
		"name": "Raycast",
		"meta": { "version": ">=0.2.5" },
		"on": { "raycast": { "file": "raycast.js" } },
		"chords": { "/(.*)": {
			"name": "Raycast: Search $1",
			"fallback": true,
			"@input:raycast": ["$1"]
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
	imports,
	scripts,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, imports, name, packageManager, repository, scripts, type, version };
