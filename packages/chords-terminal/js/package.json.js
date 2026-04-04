//#region package.json
var name = "@keychord/chords-terminal";
var version = "0.0.0";
var type = "module";
var imports = { "#/*": "./src/js/*" };
var dependencies = {
	"array-uniq": "latest",
	"brace-expansion": "latest",
	"js-yaml": "latest",
	"just-zip-it": "latest"
};
var devDependencies = {
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/js-yaml": "latest"
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
