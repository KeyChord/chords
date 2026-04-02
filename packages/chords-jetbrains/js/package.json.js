//#region package.json
var name = "@keychord/chords-jetbrains";
var type = "module";
var packageManager = "pnpm@10.33.0";
var dependencies = {
	"nano-spawn-compat": "catalog:",
	"outdent": "catalog:"
};
var devDependencies = {
	"@keychord/tsconfig": "catalog:",
	"@keychord/config": "catalog:"
};
var package_default = {
	name,
	type,
	packageManager,
	dependencies,
	devDependencies
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, type };
