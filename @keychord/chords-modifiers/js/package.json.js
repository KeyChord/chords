//#region package.json
var name = "@keychord/chords-modifiers";
var version = "0.0.0";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-modifiers"
};
var type = "module";
var exports = { ".": "./src/js/keys.ts" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var package_default = {
	name,
	version,
	repository,
	type,
	exports,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, devDependencies, exports, name, packageManager, repository, type, version };
