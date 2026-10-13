//#region package.json
var name = "@keychord/chords-chromium";
var version = "0.0.0";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-chromium"
};
var type = "module";
var dependencies = {
	"chrome-remote-interface": "latest",
	"desm": "latest",
	"get-port": "latest",
	"jquery-as-string": "latest",
	"nano-spawn-compat": "latest"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/chrome-remote-interface": "latest",
	"bun-types": "latest",
	"dax": "latest"
};
var packageManager = "pnpm@12.11.2";
var package_default = {
	name,
	version,
	repository,
	type,
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, repository, type, version };
