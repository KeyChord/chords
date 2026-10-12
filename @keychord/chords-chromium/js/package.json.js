//#region package.json
var name = "@keychord/chords-chromium";
var version = "0.0.0";
var type = "module";
var dependencies = {
	"chrome-remote-interface": "latest",
	"desm": "latest",
	"get-port": "latest",
	"jquery-as-string": "latest",
	"nano-spawn-compat": "latest"
};
var devDependencies = {
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/chrome-remote-interface": "latest",
	"bun-types": "latest",
	"dax": "latest"
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
