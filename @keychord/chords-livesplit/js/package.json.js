//#region package.json
var name = "@keychord/chords-livesplit";
var displayName = "LiveSplit Chords";
var version = "0.0.1";
var description = "Chords for LiveSplit One on desktop and Chromium.";
var categories = ["Utilities"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-livesplit"
};
var type = "module";
var scripts = {
	"build:bridge": "bun scripts/build-bridge.ts",
	"test": "bun test --isolate"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "^1.4.3",
	"happy-dom": "^21.0.1"
};
var packageManager = "pnpm@12.11.2";
var chords = { "org": { "livesplit": { "one": {
	"linux.toml": {
		"name": "LiveSplit One Web",
		"executables": ["keychord-livesplit"],
		"meta": { "chord": ">=0.3.4" },
		"on": { "livesplit": { "file": "livesplit-linux.js" } },
		"chords": { "v,tm": {
			"name": "Vary Setting: Time Milliseconds",
			"@input:livesplit": ["TOGGLE_MILLISECONDS"]
		} }
	},
	"macos.toml": {
		"name": "LiveSplit One",
		"executables": ["LiveSplit One"],
		"on": { "livesplit": { "file": "livesplit.js" } },
		"chords": { "v,tm": {
			"name": "Vary Setting: Time Milliseconds",
			"@input:livesplit": ["TOGGLE_MILLISECONDS"]
		} }
	},
	"windows.toml": {
		"name": "LiveSplit One",
		"executables": ["LiveSplit One.exe", "livesplit-one.exe"],
		"meta": { "chord": ">=0.3.4" },
		"on": { "livesplit": { "file": "livesplit-windows.js" } },
		"chords": { "v,tm": {
			"name": "Vary Setting: Time Milliseconds",
			"@input:livesplit": ["TOGGLE_MILLISECONDS"]
		} }
	}
} } } };
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
