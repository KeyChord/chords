//#region package.json
var name = "@keychord/chords-terminal";
var version = "0.0.0";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-terminal"
};
var type = "module";
var imports = { "#/*": "./src/js/*" };
var dependencies = {
	"array-uniq": "latest",
	"brace-expansion": "latest",
	"js-yaml": "latest",
	"just-zip-it": "latest"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/js-yaml": "latest"
};
var packageManager = "pnpm@12.11.2";
var package_default = {
	name,
	version,
	repository,
	type,
	imports,
	dependencies,
	devDependencies,
	packageManager
};
//#endregion
export { package_default as default, dependencies, devDependencies, imports, name, packageManager, repository, type, version };
