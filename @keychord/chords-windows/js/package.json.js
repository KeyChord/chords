//#region package.json
var name = "@keychord/chords-windows";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-windows"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
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
		"?/wdw": { "name": "Window: Dimensions, Width" },
		"/wdw([^=-].*)": {
			"name": "Window: Dimensions, Width (Set)",
			"@input:window": ["DIMENSIONS", "$1"]
		},
		"?/wdw=": { "name": "Window: Dimensions, Width (Increase)" },
		"/wdw=([0-9]?)": {
			"name": "Window: Dimensions, Width (Increase)",
			"@input:window": ["DIMENSIONS_INCREASE", "$1"]
		},
		"?/wdw-": { "name": "Window: Dimensions, Width (Decrease)" },
		"/wdw-([0-9]?)": {
			"name": "Window: Dimensions, Width (Decrease)",
			"@input:window": ["DIMENSIONS_DECREASE", "$1"]
		},
		"?/wdh": { "name": "Window: Dimensions, Height" },
		"/wdh([^=-].*)": {
			"name": "Window: Dimensions, Height (Set)",
			"@input:window": ["DIMENSIONS", "$1"]
		},
		"?/wdh=": { "name": "Window: Dimensions, Height (Increase)" },
		"/wdh=([0-9]?)": {
			"name": "Window: Dimensions, Height (Increase)",
			"@input:window": ["DIMENSIONS_INCREASE", "$1"]
		},
		"?/wdh-": { "name": "Window: Dimensions, Height (Decrease)" },
		"/wdh-([0-9]?)": {
			"name": "Window: Dimensions, Height (Decrease)",
			"@input:window": ["DIMENSIONS_DECREASE", "$1"]
		},
		"?/wd": { "name": "Window: Dimensions" },
		"/wd([^wh=-].*)": {
			"name": "Window: Dimensions (Set)",
			"@input:window": ["DIMENSIONS", "$1"]
		},
		"?/wd=": { "name": "Window: Dimensions (Increase)" },
		"/wd=([0-9]?)": {
			"name": "Window: Dimensions (Increase)",
			"@input:window": ["DIMENSIONS_INCREASE", "$1"]
		},
		"?/wd-": { "name": "Window: Dimensions (Decrease)" },
		"/wd-([0-9]?)": {
			"name": "Window: Dimensions (Decrease)",
			"@input:window": ["DIMENSIONS_DECREASE", "$1"]
		},
		"/w([0-9\\s-]+)": {
			"name": "Window: Dimensions + Position",
			"@input:window": ["FRAME", "$1"]
		},
		"?/ws": { "name": "Window: Space" },
		"/ws(\\d+)": {
			"name": "Window: Space $1 (Move)",
			"@input:window": ["SPACE", "$1"]
		},
		"/ws]": {
			"name": "Window: Space (Next)",
			"@input:window": ["SPACE", "NEXT"]
		},
		"/ws[": {
			"name": "Window: Space (Previous)",
			"@input:window": ["SPACE", "PREVIOUS"]
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
		"/w[": {
			"name": "Window: Previous",
			"@input:window": ["CYCLE", "PREVIOUS"]
		},
		"/w]": {
			"name": "Window: Next",
			"@input:window": ["CYCLE", "NEXT"]
		}
	}
} };
var package_default = {
	name,
	repository,
	type,
	scripts,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { chords, package_default as default, devDependencies, name, packageManager, repository, scripts, type };
