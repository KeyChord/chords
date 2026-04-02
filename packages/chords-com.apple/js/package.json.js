//#region package.json
var name = "@keychord/chords-com.apple";
var type = "module";
var version = "0.0.0";
var dependencies = {
	"@keychord/chords-menu": "github:KeyChord/chords-menu",
	"desm": "^1.3.1",
	"get-port": "^7.2.0",
	"jquery-as-string": "^0.4.0",
	"jxa-run-compat": "^1.6.0",
	"nano-spawn-compat": "^2.0.6",
	"outdent": "^0.8.0"
};
var devDependencies = {
	"@jxa/global-type": "^1.4.0",
	"@keychord/config": "^0.0.6",
	"@keychord/tsconfig": "^0.0.5",
	"typescript": "^6.0.2"
};
var packageManager = "pnpm@10.33.0";
var package_default = {
	name,
	type,
	version,
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, packageManager, type, version };
