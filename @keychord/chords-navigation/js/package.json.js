//#region package.json
var name = "@keychord/chords-navigation";
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
	"on": { "navigation": { "file": "navigation.js" } },
	"chords": {
		"?[": { "name": "Navigation: Back / Dismiss" },
		"?]": { "name": "Navigation: Continue / Options" },
		"[[": {
			"name": "Navigation: Back / Escape",
			"@input:navigation": ["PREVIOUS"]
		},
		"]]": {
			"name": "Navigation: Next / Continue",
			"@input:navigation": ["NEXT"]
		},
		"[x": {
			"name": "Navigation: Close Dialog",
			"@input:navigation": ["CLOSE"]
		},
		"](\\d+)": {
			"name": "Navigation: Option $1",
			"@input:navigation": ["OPTION", "$1"]
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
