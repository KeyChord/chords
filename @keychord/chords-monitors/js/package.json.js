//#region package.json
var name = "@keychord/chords-monitors";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-monitors"
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
var chords = { "macos.toml": {
	"name": "macOS Monitors",
	"on": { "monitor": { "file": "monitor.js" } },
	"chords": {
		"?/m": { "name": "Monitors" },
		"?/m\"#\"": { "name": "Monitor: Focus #" },
		"/m([1-9]\\d*)": {
			"name": "Monitor: Focus $1",
			"@input:monitor": ["$1"]
		},
		"/m[": {
			"name": "Monitor: Previous",
			"@input:monitor": ["PREVIOUS"]
		},
		"/m]": {
			"name": "Monitor: Next",
			"@input:monitor": ["NEXT"]
		},
		"/ml": {
			"name": "Monitor: Left",
			"@input:monitor": ["LEFT"]
		},
		"/mr": {
			"name": "Monitor: Right",
			"@input:monitor": ["RIGHT"]
		},
		"/mt": {
			"name": "Monitor: Top",
			"@input:monitor": ["UP"]
		},
		"/mb": {
			"name": "Monitor: Bottom",
			"@input:monitor": ["DOWN"]
		}
	}
} };
var package_default = {
	name,
	repository,
	type,
	scripts,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { chords, package_default as default, devDependencies, name, packageManager, repository, scripts, type };
