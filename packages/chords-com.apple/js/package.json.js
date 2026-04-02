//#region package.json
var name = "@keychord/chords-com.apple";
var version = "0.0.0";
var type = "module";
var dependencies = {
	"@keychord/chords-menu": "github:KeyChord/chords-menu",
	"desm": "catalog:",
	"get-port": "catalog:",
	"jquery-as-string": "catalog:",
	"jxa-run-compat": "catalog:",
	"nano-spawn-compat": "catalog:",
	"outdent": "catalog:"
};
var devDependencies = {
	"@jxa/global-type": "catalog:",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
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
