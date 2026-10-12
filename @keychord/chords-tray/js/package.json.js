//#region package.json
var name = "@keychord/chords-tray";
var version = "0.0.0";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-tray"
};
var type = "module";
var scripts = {
	"build:native": "bun scripts/build-native.ts",
	"test": "bun test"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@10.33.0";
var package_default = {
	name,
	version,
	repository,
	type,
	scripts,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, devDependencies, name, packageManager, repository, scripts, type, version };
