//#region package.json
var name = "@keychord/chords-spaces";
var displayName = "Spaces Chords";
var version = "0.0.2";
var description = "Switch between macOS Spaces by direction or desktop number.";
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
var chords = { "macos.toml": {
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
} };
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
