//#region package.json
var name = "@keychord/chords-vscode";
var type = "module";
var version = "0.0.0";
var packageManager = "pnpm@10.33.0";
var devDependencies = {
	"@keychord/tsconfig": "catalog:",
	"@keychord/config": "catalog:",
	"typescript": "catalog:"
};
var dependencies = { "nano-spawn-compat": "catalog:" };
var package_default = {
	name,
	type,
	version,
	packageManager,
	devDependencies,
	dependencies
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, type, version };
