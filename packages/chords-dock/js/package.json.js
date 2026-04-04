//#region package.json
var name = "@keychord/chords-dock";
var type = "module";
var dependencies = { "jxa-run-compat": "latest" };
var devDependencies = {
	"@jxa/global-type": "latest",
	"@keychord/chords-menu": "github:KeyChord/chords-menu",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:"
};
var packageManager = "pnpm@10.33.0";
var package_default = {
	name,
	type,
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, type };
