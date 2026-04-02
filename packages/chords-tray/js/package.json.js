//#region package.json
var name = "@keychord/chords-tray";
var version = "0.0.0";
var type = "module";
var dependencies = { "jxa-run-compat": "catalog:" };
var devDependencies = {
	"@jxa/global-type": "catalog:",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:"
};
var packageManager = "pnpm@10.33.0";
var package_default = {
	name,
	version,
	type,
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, type, version };
