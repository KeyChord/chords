//#region package.json
var name = "@keychord/chords-tray";
var version = "0.0.0";
var type = "module";
var dependencies = { "jxa-run-compat": "^1.6.0" };
var devDependencies = {
	"@jxa/global-type": "^1.4.0",
	"@keychord/config": "^0.0.6",
	"@keychord/tsconfig": "^0.0.6"
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
