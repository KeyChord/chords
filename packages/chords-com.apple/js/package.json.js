//#region package.json
var name = "@keychord/chords-com.apple";
var version = "0.0.0";
var type = "module";
var dependencies = {
	"@keychord/chords-menu": "workspace:*",
	"desm": "latest",
	"get-port": "latest",
	"jquery-as-string": "latest",
	"ky": "^1.14.3",
	"outdent": "latest"
};
var devDependencies = {
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
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
