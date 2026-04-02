//#region package.json
var name = "@keychord/chords-vscode";
var type = "module";
var version = "0.0.0";
var packageManager = "pnpm@10.33.0";
var devDependencies = {
	"@keychord/tsconfig": "^0.0.6",
	"@keychord/config": "^0.0.6",
	"typescript": "^6.0.2"
};
var dependencies = { "nano-spawn-compat": "^2.0.6" };
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
