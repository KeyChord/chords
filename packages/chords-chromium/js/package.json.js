//#region package.json
var name = "@keychord/chords-chromium";
var version = "0.0.0";
var type = "module";
var packageManager = "pnpm@10.33.0";
var dependencies = {
	"chrome-remote-interface": "catalog:",
	"desm": "catalog:",
	"get-port": "catalog:",
	"jquery-as-string": "catalog:",
	"nano-spawn-compat": "catalog:"
};
var devDependencies = {
	"@keychord/tsconfig": "catalog:",
	"@keychord/config": "catalog:",
	"@types/chrome-remote-interface": "catalog:",
	"bun-types": "catalog:",
	"dax": "catalog:",
	"typescript": "catalog:"
};
var package_default = {
	name,
	version,
	type,
	packageManager,
	dependencies,
	devDependencies
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, type, version };
