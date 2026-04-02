//#region package.json
var name = "@keychord/chords-chromium";
var version = "0.0.0";
var type = "module";
var packageManager = "pnpm@10.33.0";
var dependencies = {
	"chrome-remote-interface": "^0.34.0",
	"desm": "^1.3.1",
	"get-port": "^7.2.0",
	"jquery-as-string": "^0.4.0",
	"nano-spawn-compat": "^2.0.6"
};
var devDependencies = {
	"@keychord/tsconfig": "^0.0.6",
	"@keychord/config": "^0.0.5",
	"@types/chrome-remote-interface": "^0.33.0",
	"bun-types": "^1.3.11",
	"dax": "^0.45.0",
	"typescript": "^6.0.2"
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
