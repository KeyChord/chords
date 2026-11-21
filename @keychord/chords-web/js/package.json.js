//#region package.json
var name = "@keychord/chords-web";
var version = "0.0.1";
var displayName = "Web Chords";
var description = "Global chords for the active tab in Chrome, Brave, Edge or Arc, such as scrolling.";
var categories = ["Browsers"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-web"
};
var type = "module";
var dependencies = {
	"jquery-as-string": "^0.4.0",
	"outdent": "^0.8.0"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
	"name": "Web chords",
	"on": { "js": { "file": "web.js" } },
	"chords": {}
} };
var package_default = {
	name,
	version,
	displayName,
	description,
	categories,
	repository,
	type,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, name, packageManager, repository, type, version };
