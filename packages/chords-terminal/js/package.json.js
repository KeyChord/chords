//#region package.json
var name = "@keychord/chords-terminal";
var version = "0.0.0";
var type = "module";
var imports = { "#/*": "./src/js/*" };
var dependencies = {
	"array-uniq": "catalog:",
	"brace-expansion": "catalog:",
	"js-yaml": "catalog:",
	"just-zip-it": "catalog:"
};
var devDependencies = {
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/js-yaml": "catalog:"
};
var packageManager = "pnpm@10.33.0";
var package_default = {
	name,
	version,
	type,
	imports,
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, imports, name, packageManager, type, version };
