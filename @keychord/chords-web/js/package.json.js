//#region package.json
var name = "@keychord/chords-web";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-web"
};
var type = "module";
var dependencies = {
	"jquery-as-string": "^0.4.0",
	"outdent": "^0.8.0"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var package_default = {
	name,
	repository,
	type,
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, repository, type };
