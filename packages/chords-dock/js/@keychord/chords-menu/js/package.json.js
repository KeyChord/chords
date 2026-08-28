//#region package.json
var name = "@keychord/chords-menu";
var version = "0.0.1";
var type = "module";
var imports = { "#/*": "./src/js/*" };
var dependencies = { "jxa-run-compat": "latest" };
var devDependencies = {
	"@jxa/global-type": "latest",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:"
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
