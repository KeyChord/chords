//#region package.json
var name = "@keychord/chords-betterdisplay";
var version = "0.0.1";
var displayName = "BetterDisplay Chords";
var description = "Set the resolution of the display under the pointer with BetterDisplay.";
var categories = ["Utilities"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-betterdisplay"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var dependencies = {
	"p-wait-for": "^6.0.0",
	"uuid": "^14.0.3",
	"validator": "^13.15.35"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest",
	"@types/validator": "^13.15.10"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
	"name": "BetterDisplay",
	"meta": { "chord": ">=0.3.0" },
	"on": { "monitor": { "file": "monitor.js" } },
	"placeholders": { "<>": {
		"name": "Monitor prefix",
		"default": "m"
	} },
	"chords": {
		"?<>d": { "name": "Monitor: Dimensions" },
		"<>d(.+)": {
			"name": "Monitor: Dimensions (Set)",
			"@input:monitor": ["$1"]
		}
	}
} };
var package_default = {
	name,
	version,
	displayName,
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
