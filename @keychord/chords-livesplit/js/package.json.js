//#region package.json
var name = "@keychord/chords-livesplit";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-livesplit"
};
var type = "module";
var scripts = {
	"build:bridge": "bun scripts/build-bridge.ts",
	"test": "bun test --isolate"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "^1.4.3",
	"happy-dom": "^21.0.1"
};
var packageManager = "pnpm@12.11.2";
var chords = { "org": { "livesplit": { "one": { "macos.toml": {
	"name": "LiveSplit One",
	"executables": ["LiveSplit One"],
	"on": { "livesplit": { "file": "livesplit.js" } },
	"chords": { "v,tm": {
		"name": "Vary Setting: Time Milliseconds",
		"@input:livesplit": ["TOGGLE_MILLISECONDS"]
	} }
} } } } };
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
