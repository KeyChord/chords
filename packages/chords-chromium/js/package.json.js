//#region package.json
var name = "@keychord/chords-chromium";
var version = "0.0.0";
var type = "module";
var dependencies = {
	"chrome-remote-interface": "catalog:",
	"desm": "catalog:",
	"get-port": "catalog:",
	"jquery-as-string": "catalog:",
	"nano-spawn-compat": "catalog:"
};
var devDependencies = {
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/chrome-remote-interface": "catalog:",
	"bun-types": "catalog:",
	"dax": "catalog:",
	"typescript": "catalog:"
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
