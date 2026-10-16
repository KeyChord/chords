//#region package.json
var name = "@keychord/chords-windows";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-windows"
};
var type = "module";
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
	"name": "macOS Windows",
	"on": { "window": { "file": "window.js" } },
	"chords": {
		"?/w": { "name": "Window" },
		"/wl": {
			"name": "Window: left",
			"@input:window": ["PRESET", "LEFT"]
		},
		"/wr": {
			"name": "Window: right",
			"@input:window": ["PRESET", "RIGHT"]
		},
		"/wt": {
			"name": "Window: top",
			"@input:window": ["PRESET", "TOP"]
		},
		"/wb": {
			"name": "Window: bottom",
			"@input:window": ["PRESET", "BOTTOM"]
		},
		"/wtl": {
			"name": "Window: top-left",
			"@input:window": ["PRESET", "TOP_LEFT"]
		},
		"/wtr": {
			"name": "Window: top-right",
			"@input:window": ["PRESET", "TOP_RIGHT"]
		},
		"/wbl": {
			"name": "Window: bottom-left",
			"@input:window": ["PRESET", "BOTTOM_LEFT"]
		},
		"/wbr": {
			"name": "Window: bottom-right",
			"@input:window": ["PRESET", "BOTTOM_RIGHT"]
		},
		"/wlr": {
			"name": "Window: horizontal",
			"@input:window": ["PRESET", "HORIZONTAL"]
		},
		"/wrl": {
			"name": "Window: horizontal",
			"@input:window": ["PRESET", "HORIZONTAL"]
		},
		"/wtb": {
			"name": "Window: vertical",
			"@input:window": ["PRESET", "VERTICAL"]
		},
		"/wbt": {
			"name": "Window: vertical",
			"@input:window": ["PRESET", "VERTICAL"]
		},
		"/wf": {
			"name": "Window: fill",
			"@input:window": ["PRESET", "FILL"]
		},
		"/wc": {
			"name": "Window: center",
			"@input:window": ["PRESET", "CENTER"]
		},
		"?/wpx": { "name": "Window: Position, X" },
		"/wpx(.+)": {
			"name": "Window: Position, X (Set)",
			"@input:window": ["POSITION", "$1"]
		},
		"?/wpy": { "name": "Window: Position, Y" },
		"/wpy(.+)": {
			"name": "Window: Position, Y (Set)",
			"@input:window": ["POSITION", "$1"]
		},
		"?/wp": { "name": "Window: Position" },
		"/wp(.+)": {
			"name": "Window: Position (Set)",
			"@input:window": ["POSITION", "$1"]
		},
		"?/wsw": { "name": "Window: Size, Width" },
		"/wsw(.+)": {
			"name": "Window: Size, Width (Set)",
			"@input:window": ["SIZE", "$1"]
		},
		"?/wsh": { "name": "Window: Size, Height" },
		"/wsh(.+)": {
			"name": "Window: Size, Height (Set)",
			"@input:window": ["SIZE", "$1"]
		},
		"?/ws": { "name": "Window: Size" },
		"/ws(.+)": {
			"name": "Window: Size (Set)",
			"@input:window": ["SIZE", "$1"]
		},
		"/w([0-9\\s-]+)": {
			"name": "Window: Size + Position",
			"@input:window": ["FRAME", "$1"]
		},
		"/h": {
			"name": "Hide",
			"shortcut": "cmd+h"
		},
		"/m": {
			"name": "Minimize",
			"shortcut": "cmd+m"
		},
		"/q": {
			"name": "Quit",
			"shortcut": "cmd+q"
		},
		"/wh": {
			"name": "Window: Hide",
			"shortcut": "cmd+h"
		},
		"/wm": {
			"name": "Window: Minimize",
			"shortcut": "cmd+m"
		},
		"/wq": {
			"name": "Window: Quit",
			"shortcut": "cmd+q"
		},
		"/w[": { "name": "Window: Previous " },
		"/w]": { "name": "Window: Window" }
	}
} };
var package_default = {
	name,
	repository,
	type,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { chords, package_default as default, devDependencies, name, packageManager, repository, type };
