//#region package.json
var name = "@keychord/chords-vscode";
var version = "0.0.0";
var type = "module";
var dependencies = { "nano-spawn-compat": "catalog:" };
var devDependencies = {
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"typescript": "catalog:"
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
