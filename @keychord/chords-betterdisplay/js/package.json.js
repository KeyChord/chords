//#region package.json
var name = "@keychord/chords-betterdisplay";
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
	"on": { "monitor": { "file": "monitor.js" } },
	"chords": {
		"?/md": { "name": "Monitor: Dimensions" },
		"/md(.+)": {
			"name": "Monitor: Dimensions (Set)",
			"@input:monitor": ["$1"]
		}
	}
} };
var package_default = {
	name,
	repository,
	type,
	scripts,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { chords, package_default as default, dependencies, devDependencies, name, packageManager, repository, scripts, type };
