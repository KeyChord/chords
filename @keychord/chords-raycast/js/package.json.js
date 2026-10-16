//#region package.json
var name = "@keychord/chords-raycast";
var version = "0.0.0";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-raycast"
};
var type = "module";
var imports = { "#/*": "./src/js/*" };
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
		"on": { "raycast": { "file": "raycast.js" } },
		"chords": { "//(.*)": {
			"name": "Raycast: Search $1",
			"@input:raycast": ["$1"]
		} }
	}
};
var package_default = {
	name,
	version,
	repository,
	type,
	imports,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { chords, package_default as default, dependencies, devDependencies, imports, name, packageManager, repository, type, version };
