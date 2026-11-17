//#region package.json
var name = "@keychord/chords-monitors";
var version = "0.0.1";
var displayName = "Monitor Chords";
var description = "Focus monitors by number, order or direction.";
var categories = ["Window Management"];
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
	"meta": { "chord": ">=0.3.0" },
	"on": { "monitor": { "file": "monitor.js" } },
	"placeholders": { "<>": {
		"name": "Monitor prefix",
		"default": "m"
	} },
	"chords": {
		"?<>": { "name": "Monitors" },
		"?<>\"1-9\"": { "name": "Monitor: Focus #" },
		"<>([1-9]\\d*)": {
			"name": "Monitor: Focus $1",
			"@input:monitor": ["$1"]
		},
		"<>[": {
			"name": "Monitor: Previous",
			"@input:monitor": ["PREVIOUS"]
		},
		"<>]": {
			"name": "Monitor: Next",
			"@input:monitor": ["NEXT"]
		},
		"<>l": {
			"name": "Monitor: Left",
			"@input:monitor": ["LEFT"]
		},
		"<>r": {
			"name": "Monitor: Right",
			"@input:monitor": ["RIGHT"]
		},
		"<>t": {
			"name": "Monitor: Top",
			"@input:monitor": ["UP"]
		},
		"<>b": {
			"name": "Monitor: Bottom",
			"@input:monitor": ["DOWN"]
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
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, description, devDependencies, displayName, name, packageManager, repository, scripts, type, version };
