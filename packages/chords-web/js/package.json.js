//#region package.json
var name = "@keychord/chords-web";
var type = "module";
var dependencies = {
	"jquery-as-string": "^0.4.0",
	"jxa-run-compat": "^1.6.0",
	"outdent": "^0.8.0"
};
var devDependencies = {
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@jxa/global-type": "^1.4.0"
};
var package_default = {
	name,
	type,
	dependencies,
	devDependencies
};
//#endregion
export { package_default as default, dependencies, devDependencies, name, type };
