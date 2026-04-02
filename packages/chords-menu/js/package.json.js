//#region package.json
var name = "@keychord/chords-menu";
var type = "module";
var version = "0.0.1";
var imports = { "#/*": "./src/js/*" };
var dependencies = { "jxa-run-compat": "^1.6.0" };
var devDependencies = {
	"@jxa/global-type": "^1.4.0",
	"@keychord/config": "^0.0.1",
	"@keychord/tsconfig": "latest"
};
var packageManager = "pnpm@10.33.0";
var package_default = {
	name,
	type,
	version,
	imports,
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, imports, name, packageManager, type, version };
