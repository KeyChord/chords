//#region package.json
var name = "@keychord/chords-jetbrains";
var type = "module";
var packageManager = "pnpm@10.33.0";
var dependencies = {
	"nano-spawn-compat": "^2.0.6",
	"outdent": "^0.8.0"
};
var devDependencies = {
	"@keychord/tsconfig": "catalog:",
	"@keychord/config": "^0.0.6"
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
