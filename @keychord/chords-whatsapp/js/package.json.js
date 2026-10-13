//#region package.json
var name = "@keychord/chords-whatsapp";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-whatsapp"
};
var type = "module";
var devDependencies = {
	"@keychord/chords-menu": "workspace:*",
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:"
};
var packageManager = "pnpm@12.11.2";
var package_default = {
	name,
	repository,
	type,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, devDependencies, name, packageManager, repository, type };
