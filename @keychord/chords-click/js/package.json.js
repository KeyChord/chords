//#region package.json
var name = "@keychord/chords-click";
var displayName = "Click Chords";
var version = "0.0.2";
var description = "Mouse clicks, drags and pointer moves by coordinates, in the focused window or on the screen.";
var categories = ["Input"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-click"
};
var type = "module";
var exports = {
	".": "./src/js/click.ts",
	"./sequence": "./src/js/utils/click-sequence.ts"
};
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
	"name": "Mouse",
	"meta": { "chord": ">=0.3.0" },
	"on": { "click": { "file": "click.js" } },
	"placeholders": { "<>": {
		"name": "Mouse prefix",
		"default": "c"
	} },
	"chords": {
		"?<>": { "name": "Click" },
		"?<>.": { "name": "Double Click" },
		"?<>,": { "name": "Right Click" },
		"?<>;": { "name": "Middle Click" },
		"?<>-": { "name": "Drag" },
		"?<>,-": { "name": "Right Drag" },
		"?<>;-": { "name": "Middle Drag" },
		"?<>=": { "name": "Move Mouse" },
		"?<>/": { "name": "Global Mouse" },
		"<>([.,;=/0-9-].*)": {
			"name": "Mouse",
			"@input:click": ["$1", "COMMAND"]
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
	exports,
	scripts,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, description, devDependencies, displayName, exports, name, packageManager, repository, scripts, type, version };
