//#region package.json
var name = "@keychord/chords-navigation";
var version = "0.0.1";
var displayName = "Navigation Chords";
var description = "Go back, continue, dismiss dialogs and press numbered options in whichever app is focused, through Accessibility.";
var categories = ["Input"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-navigation"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chords-whatsapp": "workspace:*",
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
	"name": "Navigation",
	"meta": { "chord": ">=0.3.0" },
	"on": { "navigation": { "file": "navigation.js" } },
	"placeholders": { "<>": {
		"name": "Navigation prefix",
		"default": "n"
	} },
	"chords": {
		"?<>": { "name": "Navigation" },
		"<>[": {
			"name": "Navigation: Back / Escape",
			"@input:navigation": ["PREVIOUS"]
		},
		"<>]": {
			"name": "Navigation: Next / Continue",
			"@input:navigation": ["NEXT"]
		},
		"<>x": {
			"name": "Navigation: Close Dialog",
			"@input:navigation": ["CLOSE"]
		},
		"<>(\\d+)": {
			"name": "Navigation: Option $1",
			"@input:navigation": ["OPTION", "$1"]
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
