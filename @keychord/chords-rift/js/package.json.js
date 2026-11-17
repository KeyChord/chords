//#region package.json
var name = "@keychord/chords-rift";
var version = "0.0.1";
var displayName = "Rift Chords";
var description = "Global chords that run commands for the Rift tiling window manager.";
var categories = ["Window Management"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-rift"
};
var type = "module";
var scripts = {
	"test": "bun test --isolate",
	"test:live": "CHORD_RIFT_LIVE_TEST=1 bun test __tests__/rift.live.test.ts"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/bun": "^1.4.3"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
	"name": "Rift",
	"meta": {
		"chord": ">=0.3.0",
		"$wrap": false
	},
	"placeholders": { "<>": {
		"name": "Window management prefix",
		"default": "r"
	} },
	"on": { "rift": { "file": "rift.js" } },
	"chords": {
		"?<>": { "name": "Rift" },
		"<>q": {
			"name": "Quit Window",
			"shell": "rift-cli execute window close"
		},
		"<>v": {
			"name": "Vary: Manage This Space",
			"shell": "rift-cli execute space toggle-activated"
		},
		"<>w": {
			"name": "West (Window)",
			"shell": "rift-cli execute window focus left"
		},
		"<>e": {
			"name": "East (Window)",
			"shell": "rift-cli execute window focus right"
		},
		"<>n": {
			"name": "North (Window)",
			"shell": "rift-cli execute window focus up"
		},
		"<>s": {
			"name": "South (Window)",
			"shell": "rift-cli execute window focus down"
		},
		"<>m": {
			"name": "Master (Window)",
			"@input:rift": ["FOCUS_MASTER"]
		},
		"<>]": {
			"name": "Next (Window)",
			"shell": "rift-cli execute window next"
		},
		"<>[": {
			"name": "Previous (Window)",
			"shell": "rift-cli execute window prev"
		},
		"<>l": {
			"name": "Left (Move Window)",
			"shell": "rift-cli execute layout move-node left"
		},
		"<>r": {
			"name": "Right (Move Window)",
			"shell": "rift-cli execute layout move-node right"
		},
		"<>u": {
			"name": "Up (Move Window)",
			"shell": "rift-cli execute layout move-node up"
		},
		"<>d": {
			"name": "Down (Move Window)",
			"shell": "rift-cli execute layout move-node down"
		},
		"<>f": {
			"name": "Forwards (Move Window)",
			"@input:rift": ["MOVE_FORWARD"]
		},
		"<>k": {
			"name": "Backwards (Move Window)",
			"@input:rift": ["MOVE_BACKWARD"]
		},
		"<>t": {
			"name": "Top (Move Window)",
			"@input:rift": ["MOVE_TO_TOP"]
		},
		"<>b": {
			"name": "Bottom (Move Window)",
			"@input:rift": ["MOVE_TO_BOTTOM"]
		},
		"<>p": {
			"name": "Promote to Master (Move Window)",
			"shell": "rift-cli execute layout promote-to-master"
		},
		"?<>j": { "name": "Join" },
		"<>jl": {
			"name": "Join: Left",
			"shell": "rift-cli execute layout join-window left"
		},
		"<>jr": {
			"name": "Join: Right",
			"shell": "rift-cli execute layout join-window right"
		},
		"<>ju": {
			"name": "Join: Up",
			"shell": "rift-cli execute layout join-window up"
		},
		"<>jd": {
			"name": "Join: Down",
			"shell": "rift-cli execute layout join-window down"
		},
		"<>jx": {
			"name": "Join: Unjoin",
			"shell": "rift-cli execute layout unjoin"
		},
		"?<>v": { "name": "Vary" },
		"<>vf": {
			"name": "Vary: Floating",
			"shell": "rift-cli execute window toggle-float"
		},
		"<>vs": {
			"name": "Vary: Stacked",
			"shell": "rift-cli execute layout toggle-stack"
		},
		"<>vo": {
			"name": "Vary: Orientation",
			"shell": "rift-cli execute layout toggle-orientation"
		},
		"?<>z": { "name": "Zoom" },
		"<>zf": {
			"name": "Zoom: Fullscreen",
			"shell": "rift-cli execute window toggle-fullscreen"
		},
		"<>zg": {
			"name": "Zoom: Fullscreen Within Gaps",
			"shell": "rift-cli execute window toggle-fullscreen-within-gaps"
		},
		"?<>r": { "name": "Resize" },
		"<>r=": {
			"name": "Resize: Increase",
			"shell": "rift-cli execute window resize-grow --orientation smart"
		},
		"<>r-": {
			"name": "Resize: Decrease",
			"shell": "rift-cli execute window resize-shrink --orientation smart"
		},
		"<>rw=": {
			"name": "Resize: Increase Width",
			"shell": "rift-cli execute window resize-grow --orientation horizontal"
		},
		"<>rw-": {
			"name": "Resize: Decrease Width",
			"shell": "rift-cli execute window resize-shrink --orientation horizontal"
		},
		"<>rh=": {
			"name": "Resize: Increase Height",
			"shell": "rift-cli execute window resize-grow --orientation vertical"
		},
		"<>rh-": {
			"name": "Resize: Decrease Height",
			"shell": "rift-cli execute window resize-shrink --orientation vertical"
		},
		"<>;": {
			"name": "Balance Sizes",
			"shell": "rift-cli execute layout balance"
		},
		"?<>l": { "name": "Left / Layout" },
		"<>lt": {
			"name": "Layout: Traditional",
			"shell": "rift-cli execute workspace set-layout traditional"
		},
		"<>lb": {
			"name": "Layout: BSP",
			"shell": "rift-cli execute workspace set-layout bsp"
		},
		"<>ls": {
			"name": "Layout: Stack",
			"shell": "rift-cli execute workspace set-layout stack"
		},
		"<>lm": {
			"name": "Layout: Master (Stack)",
			"shell": "rift-cli execute workspace set-layout master_stack"
		},
		"<>lml": {
			"name": "Layout: Master Left",
			"shell": "rift-cli execute config set settings.layout.master_stack.master_side left && rift-cli execute workspace set-layout master_stack"
		},
		"<>lmr": {
			"name": "Layout: Master Right",
			"shell": "rift-cli execute config set settings.layout.master_stack.master_side right && rift-cli execute workspace set-layout master_stack"
		},
		"<>lc": {
			"name": "Layout: Scrolling Columns",
			"shell": "rift-cli execute workspace set-layout scrolling"
		},
		"<>lf": {
			"name": "Layout: Floating",
			"shell": "rift-cli execute workspace set-layout floating"
		},
		"?<>lm": { "name": "Layout: Master" },
		"<>lmp": {
			"name": "Master: Promote Window",
			"shell": "rift-cli execute layout promote-to-master"
		},
		"<>lms": {
			"name": "Master: Swap With Stack",
			"shell": "rift-cli execute layout swap-master-stack"
		},
		"<>lm=": {
			"name": "Master: Increase Ratio",
			"shell": "rift-cli execute layout adjust-master-ratio 0.05"
		},
		"<>lm-": {
			"name": "Master: Decrease Ratio",
			"shell": "rift-cli execute layout adjust-master-ratio -- -0.05"
		},
		"?<>lmc": { "name": "Master: Count" },
		"<>lmc=": {
			"name": "Master: Increase Count",
			"shell": "rift-cli execute layout adjust-master-count 1"
		},
		"<>lmc-": {
			"name": "Master: Decrease Count",
			"shell": "rift-cli execute layout adjust-master-count -- -1"
		},
		"?<>c": { "name": "Column" },
		"<>cc": {
			"name": "Column: Center",
			"shell": "rift-cli execute layout center-selection"
		},
		"?<>cw": { "name": "Column: Width Preset" },
		"<>cw]": {
			"name": "Column: Next Width Preset",
			"shell": "rift-cli execute layout switch-preset-column-width"
		},
		"<>cw[": {
			"name": "Column: Previous Width Preset",
			"shell": "rift-cli execute layout switch-preset-column-width --backwards"
		},
		"?<>w": { "name": "Workspace" },
		"<>w]": {
			"name": "Workspace: Next",
			"shell": "rift-cli execute workspace next"
		},
		"<>w[": {
			"name": "Workspace: Previous",
			"shell": "rift-cli execute workspace prev"
		},
		"<>wk": {
			"name": "Workspace: Back (Last Used)",
			"shell": "rift-cli execute workspace last"
		},
		"<>w0": {
			"name": "Workspace: 0",
			"shell": "rift-cli execute workspace switch 0"
		},
		"<>w1": {
			"name": "Workspace: 1",
			"shell": "rift-cli execute workspace switch 1"
		},
		"<>w2": {
			"name": "Workspace: 2",
			"shell": "rift-cli execute workspace switch 2"
		},
		"<>w3": {
			"name": "Workspace: 3",
			"shell": "rift-cli execute workspace switch 3"
		},
		"<>w4": {
			"name": "Workspace: 4",
			"shell": "rift-cli execute workspace switch 4"
		},
		"<>w5": {
			"name": "Workspace: 5",
			"shell": "rift-cli execute workspace switch 5"
		},
		"<>w6": {
			"name": "Workspace: 6",
			"shell": "rift-cli execute workspace switch 6"
		},
		"<>w7": {
			"name": "Workspace: 7",
			"shell": "rift-cli execute workspace switch 7"
		},
		"<>w8": {
			"name": "Workspace: 8",
			"shell": "rift-cli execute workspace switch 8"
		},
		"<>w9": {
			"name": "Workspace: 9",
			"shell": "rift-cli execute workspace switch 9"
		},
		"<>wl": {
			"name": "Workspace: Left (Display)",
			"shell": "rift-cli execute display move-workspace --direction left"
		},
		"<>wr": {
			"name": "Workspace: Right (Display)",
			"shell": "rift-cli execute display move-workspace --direction right"
		},
		"<>wu": {
			"name": "Workspace: Up (Display)",
			"shell": "rift-cli execute display move-workspace --direction up"
		},
		"<>wd": {
			"name": "Workspace: Down (Display)",
			"shell": "rift-cli execute display move-workspace --direction down"
		},
		"?<>m": { "name": "Move Window" },
		"<>m0": {
			"name": "Move: (Workspace) 0",
			"shell": "rift-cli execute workspace move-window 0"
		},
		"<>m1": {
			"name": "Move: (Workspace) 1",
			"shell": "rift-cli execute workspace move-window 1"
		},
		"<>m2": {
			"name": "Move: (Workspace) 2",
			"shell": "rift-cli execute workspace move-window 2"
		},
		"<>m3": {
			"name": "Move: (Workspace) 3",
			"shell": "rift-cli execute workspace move-window 3"
		},
		"<>m4": {
			"name": "Move: (Workspace) 4",
			"shell": "rift-cli execute workspace move-window 4"
		},
		"<>m5": {
			"name": "Move: (Workspace) 5",
			"shell": "rift-cli execute workspace move-window 5"
		},
		"<>m6": {
			"name": "Move: (Workspace) 6",
			"shell": "rift-cli execute workspace move-window 6"
		},
		"<>m7": {
			"name": "Move: (Workspace) 7",
			"shell": "rift-cli execute workspace move-window 7"
		},
		"<>m8": {
			"name": "Move: (Workspace) 8",
			"shell": "rift-cli execute workspace move-window 8"
		},
		"<>m9": {
			"name": "Move: (Workspace) 9",
			"shell": "rift-cli execute workspace move-window 9"
		},
		"<>ml": {
			"name": "Move: Left (Display)",
			"shell": "rift-cli execute display move-window --direction left"
		},
		"<>mr": {
			"name": "Move: Right (Display)",
			"shell": "rift-cli execute display move-window --direction right"
		},
		"<>mu": {
			"name": "Move: Up (Display)",
			"shell": "rift-cli execute display move-window --direction up"
		},
		"<>md": {
			"name": "Move: Down (Display)",
			"shell": "rift-cli execute display move-window --direction down"
		},
		"?<>f": { "name": "Follow Window to Workspace" },
		"<>f0": {
			"name": "Follow: (to workspace) 0",
			"shell": "rift-cli execute workspace move-window 0 --follow"
		},
		"<>f1": {
			"name": "Follow: (to workspace) 1",
			"shell": "rift-cli execute workspace move-window 1 --follow"
		},
		"<>f2": {
			"name": "Follow: (to workspace) 2",
			"shell": "rift-cli execute workspace move-window 2 --follow"
		},
		"<>f3": {
			"name": "Follow: (to workspace) 3",
			"shell": "rift-cli execute workspace move-window 3 --follow"
		},
		"<>f4": {
			"name": "Follow: (to workspace) 4",
			"shell": "rift-cli execute workspace move-window 4 --follow"
		},
		"<>f5": {
			"name": "Follow: (to workspace) 5",
			"shell": "rift-cli execute workspace move-window 5 --follow"
		},
		"<>f6": {
			"name": "Follow: (to workspace) 6",
			"shell": "rift-cli execute workspace move-window 6 --follow"
		},
		"<>f7": {
			"name": "Follow: (to workspace) 7",
			"shell": "rift-cli execute workspace move-window 7 --follow"
		},
		"<>f8": {
			"name": "Follow: (to workspace) 8",
			"shell": "rift-cli execute workspace move-window 8 --follow"
		},
		"<>f9": {
			"name": "Follow: (to workspace) 9",
			"shell": "rift-cli execute workspace move-window 9 --follow"
		},
		"?<>d": { "name": "Display" },
		"<>dw": {
			"name": "Display: West",
			"shell": "rift-cli execute display focus --direction left"
		},
		"<>de": {
			"name": "Display: East",
			"shell": "rift-cli execute display focus --direction right"
		},
		"<>dn": {
			"name": "Display: North",
			"shell": "rift-cli execute display focus --direction up"
		},
		"<>ds": {
			"name": "Display: South",
			"shell": "rift-cli execute display focus --direction down"
		},
		"?<>,": { "name": "Rift Config" },
		"<>,r": {
			"name": "Rift: Reload",
			"shell": "rift-cli execute config reload"
		},
		"<>,p": {
			"name": "Rift: Play (Start)",
			"shell": "rift-cli service start"
		},
		"<>,h": {
			"name": "Rift: Halt (Stop)",
			"shell": "rift-cli service stop"
		}
	}
} };
var package_default = {
	name,
	version,
	displayName,
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
