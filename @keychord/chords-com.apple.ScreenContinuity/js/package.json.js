//#region package.json
var name = "@keychord/chords-com.apple.ScreenContinuity";
var displayName = "iPhone Mirroring Chords";
var version = "0.0.0";
var description = "Chords for iPhone Mirroring (com.apple.ScreenContinuity).";
var categories = ["macOS"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-com.apple.ScreenContinuity"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var dependencies = { "@keychord/chords-click": "workspace:*" };
var devDependencies = {
	"@keychord/chords-com.apple.Safari": "workspace:*",
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = { "com": { "apple": { "ScreenContinuity": { "macos.toml": {
	"name": "iPhone Mirroring",
	"on": {
		"tap": { "file": "screen-continuity.js" },
		"hover": {
			"file": "screen-continuity.js",
			"args": ["HOVER"]
		}
	},
	"chords": {
		"?t": { "name": "Tap" },
		"t(.+)": {
			"name": "Tap",
			"@input:tap": ["$1"]
		},
		"?h": { "name": "Hover" },
		"h(.+)": {
			"name": "Hover",
			"@input:hover": ["$1"]
		},
		"?g": { "name": "Goto" },
		"gh": {
			"name": "Goto: Home Screen",
			"shortcut": "cmd+1"
		},
		"ga": {
			"name": "Goto: App Switcher",
			"shortcut": "cmd+2"
		},
		"gs": {
			"name": "Goto: Spotlight",
			"shortcut": "cmd+3"
		},
		"gc": {
			"name": "Goto: Command Centre",
			"shortcut": "cmd+4"
		},
		"?s": { "name": "Size" },
		"s=": {
			"name": "Size: Increase (Zoom)",
			"shortcut": "cmd+="
		},
		"s-": {
			"name": "Size: Decrease (Zoom)",
			"shortcut": "cmd+-"
		},
		"s0": {
			"name": "Size: Actual",
			"shortcut": "cmd+0"
		},
		"si": {
			"name": "Size: iPhone",
			"shortcut": "cmd+9"
		}
	}
} } } } };
var package_default = {
	name,
	displayName,
	version,
	description,
	categories,
	repository,
	type,
	scripts,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, name, packageManager, repository, scripts, type, version };
