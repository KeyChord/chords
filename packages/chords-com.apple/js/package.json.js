//#region package.json
var name = "@keychord/chords-com.apple";
var version = "0.0.0";
var type = "module";
var dependencies = {
	"@keychord/chords-menu": "github:KeyChord/chords-menu",
	"desm": "latest",
	"get-port": "latest",
	"jquery-as-string": "latest",
	"jxa-run-compat": "latest",
	"ky": "^1.14.3",
	"nano-spawn-compat": "latest",
	"outdent": "latest"
};
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
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, type, version };
