//#region package.json
var name = "@keychord/chords-web";
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
	"chords": {
		"?;i": { "name": "Input" },
		";i([^,.;]*)": {
			"name": "Input: Match",
			"@input:js": ["PLACEHOLDER", "$1"]
		},
		";i([^,.;]*\\.)": {
			"name": "Input: Click (focus)",
			"@input:js": ["PLACEHOLDER", "$1"]
		},
		";i([^,.;]*\\.,)": {
			"name": "Input: Right Click",
			"@input:js": ["PLACEHOLDER", "$1"]
		},
		";a([^,.;]*)": {
			"name": "Start Selection: Match",
			"@input:js": ["SELECTION_START", "$1"]
		},
		";a([^,.;]*\\.)": {
			"name": "Start Selection: Select",
			"@input:js": ["SELECTION_START", "$1"]
		},
		";z([^,.;]*)": {
			"name": "End Selection: Match",
			"@input:js": ["SELECTION_END", "$1"]
		},
		";z([^,.;]*\\.)": {
			"name": "End Selection: Select",
			"@input:js": ["SELECTION_END", "$1"]
		},
		";z([^,.;]*\\.,)": {
			"name": "End Selection: Right Click",
			"@input:js": ["SELECTION_END", "$1"]
		},
		";l([^,.;]*)": {
			"name": "Link: Match",
			"@input:js": ["LINK", "$1"]
		},
		";l([^,.;]*\\.)": {
			"name": "Link: Click",
			"@input:js": ["LINK", "$1"]
		},
		";l([^,.;]*\\.,)": {
			"name": "Link: Right Click",
			"@input:js": ["LINK", "$1"]
		},
		";b([^,.;]*)": {
			"name": "Button: Match",
			"@input:js": ["BUTTON", "$1"]
		},
		";b([^,.;]*\\.)": {
			"name": "Button: Click",
			"@input:js": ["BUTTON", "$1"]
		},
		";b([^,.;]*\\.,)": {
			"name": "Button: Right Click",
			"@input:js": ["BUTTON", "$1"]
		},
		";n": {
			"name": "North",
			"@input:js": ["SCROLL", "NORTH"]
		},
		";s": {
			"name": "South",
			"@input:js": ["SCROLL", "SOUTH"]
		},
		";e": {
			"name": "East",
			"@input:js": ["SCROLL", "EAST"]
		},
		";w": {
			"name": "West",
			"@input:js": ["SCROLL", "WEST"]
		}
	}
} };
var package_default = {
	name,
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
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, name, packageManager, repository, type };
