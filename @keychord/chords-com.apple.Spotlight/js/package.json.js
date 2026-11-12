//#region package.json
var name = "@keychord/chords-com.apple.Spotlight";
var displayName = "Spotlight Chords";
var version = "0.0.0";
var description = "Chord's built-in launcher: `/<query>` opens Spotlight's top result for the query.";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-com.apple.Spotlight"
};
var type = "module";
var imports = { "#/*": "./src/js/*" };
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
	"name": "Spotlight",
	"meta": { "version": ">=0.2.5" },
	"on": { "spotlight": { "file": "spotlight.js" } },
	"chords": { "/(.*)": {
		"name": "Spotlight: Search $1",
		"fallback": true,
		"@input:spotlight": ["$1"]
	} }
} };
var package_default = {
	name,
	displayName,
	version,
	description,
	categories,
	repository,
	type,
	imports,
	scripts,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, description, devDependencies, displayName, imports, name, packageManager, repository, scripts, type, version };
