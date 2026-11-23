//#region package.json
var name = "@keychord/chords-com.apple.FolderActionsSetup";
var displayName = "Folder Actions Setup Chords";
var version = "0.0.2";
var description = "Chords for Folder Actions Setup (com.apple.FolderActionsSetup).";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-com.apple.FolderActionsSetup"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"com": { "apple": { "FolderActionsSetup": { "macos.toml": {
		"name": "Folder Actions Setup",
		"on": { "attach": { "file": "attach.js" } },
		"chords": {
			"?f": { "name": "Folder" },
			"fa(.+)": {
				"name": "Folder: Attach Script to $1",
				"@input:attach": ["$1"]
			}
		}
	} } } },
	"macos.toml": {
		"name": "Folder Actions Setup",
		"chords": {}
	}
};
var package_default = {
	name,
	displayName,
	version,
	description,
	categories,
	repository,
	type,
	scripts,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, description, devDependencies, displayName, name, packageManager, repository, scripts, type, version };
