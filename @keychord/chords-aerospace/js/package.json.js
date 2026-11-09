//#region package.json
var name = "@keychord/chords-aerospace";
var displayName = "AeroSpace Chords";
var description = "Global chords that run commands for the AeroSpace tiling window manager.";
var categories = ["Window Management"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-aerospace"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:"
};
var packageManager = "pnpm@12.11.2";
var chords = { "macos.toml": {
	"name": "AeroSpace",
	"meta": { "$wrap": false },
	"placeholders": { "p": {
		"name": "Window management prefix",
		"default": ";"
	} },
	"chords": {
		"<p>q": {
			"name": "Quit Window",
			"shell": "aerospace close"
		},
		"<p>v": {
			"name": "Vary: AeroSpace On/Off",
			"shell": "aerospace enable toggle"
		},
		"<p>w": {
			"name": "West (Window)",
			"shell": "aerospace focus left"
		},
		"<p>e": {
			"name": "East (Window)",
			"shell": "aerospace focus right"
		},
		"<p>n": {
			"name": "North (Window)",
			"shell": "aerospace focus up"
		},
		"<p>s": {
			"name": "South (Window)",
			"shell": "aerospace focus down"
		},
		"<p>]": {
			"name": "Next (Window)",
			"shell": "aerospace focus dfs-next"
		},
		"<p>[": {
			"name": "Previous (Window)",
			"shell": "aerospace focus dfs-prev"
		},
		"<p>l": {
			"name": "Left (Move Window)",
			"shell": "aerospace move left"
		},
		"<p>r": {
			"name": "Right (Move Window)",
			"shell": "aerospace move right"
		},
		"<p>u": {
			"name": "Up (Move Window)",
			"shell": "aerospace move up"
		},
		"<p>d": {
			"name": "Down (Move Window)",
			"shell": "aerospace move down"
		},
		"?<p>j": { "name": "Join" },
		"<p>jl": {
			"name": "Join: Left",
			"shell": "aerospace join-with left"
		},
		"<p>jr": {
			"name": "Join: Right",
			"shell": "aerospace join-with right"
		},
		"<p>ju": {
			"name": "Join: Up",
			"shell": "aerospace join-with up"
		},
		"<p>jd": {
			"name": "Join: Down",
			"shell": "aerospace join-with down"
		},
		"<p>jx": {
			"name": "Join: Unjoin All (Flatten Workspace)",
			"shell": "aerospace flatten-workspace-tree"
		},
		"?<p>v": { "name": "Vary" },
		"<p>vf": {
			"name": "Vary: Floating",
			"shell": "aerospace layout floating tiling"
		},
		"<p>vs": {
			"name": "Vary: Stacked (Accordion)",
			"shell": "aerospace layout accordion tiles"
		},
		"<p>vo": {
			"name": "Vary: Orientation",
			"shell": "aerospace layout horizontal vertical"
		},
		"?<p>z": { "name": "Zoom" },
		"<p>zf": {
			"name": "Zoom: Fullscreen",
			"shell": "aerospace fullscreen --no-outer-gaps"
		},
		"<p>zg": {
			"name": "Zoom: Fullscreen Within Gaps",
			"shell": "aerospace fullscreen"
		},
		"?<p>r": { "name": "Resize" },
		"<p>r=": {
			"name": "Resize: Increase",
			"shell": "aerospace resize smart +50"
		},
		"<p>r-": {
			"name": "Resize: Decrease",
			"shell": "aerospace resize smart -50"
		},
		"<p>rw=": {
			"name": "Resize: Increase Width",
			"shell": "aerospace resize width +50"
		},
		"<p>rw-": {
			"name": "Resize: Decrease Width",
			"shell": "aerospace resize width -50"
		},
		"<p>rh=": {
			"name": "Resize: Increase Height",
			"shell": "aerospace resize height +50"
		},
		"<p>rh-": {
			"name": "Resize: Decrease Height",
			"shell": "aerospace resize height -50"
		},
		"<p>b": {
			"name": "Balance Sizes",
			"shell": "aerospace balance-sizes"
		},
		"?<p>l": { "name": "Left / Layout" },
		"<p>lt": {
			"name": "Layout: Tiles",
			"shell": "aerospace layout --root tiles"
		},
		"<p>ls": {
			"name": "Layout: Stack (Accordion)",
			"shell": "aerospace layout --root accordion"
		},
		"<p>lf": {
			"name": "Layout: Floating (Window)",
			"shell": "aerospace layout floating"
		},
		"?<p>w": { "name": "Workspace" },
		"<p>w]": {
			"name": "Workspace: Next",
			"shell": "aerospace workspace --no-stdin next"
		},
		"<p>w[": {
			"name": "Workspace: Previous",
			"shell": "aerospace workspace --no-stdin prev"
		},
		"<p>wk": {
			"name": "Workspace: Back (Last Used)",
			"shell": "aerospace workspace-back-and-forth"
		},
		"<p>w0": {
			"name": "Workspace: 0",
			"shell": "aerospace workspace 0"
		},
		"<p>w1": {
			"name": "Workspace: 1",
			"shell": "aerospace workspace 1"
		},
		"<p>w2": {
			"name": "Workspace: 2",
			"shell": "aerospace workspace 2"
		},
		"<p>w3": {
			"name": "Workspace: 3",
			"shell": "aerospace workspace 3"
		},
		"<p>w4": {
			"name": "Workspace: 4",
			"shell": "aerospace workspace 4"
		},
		"<p>w5": {
			"name": "Workspace: 5",
			"shell": "aerospace workspace 5"
		},
		"<p>w6": {
			"name": "Workspace: 6",
			"shell": "aerospace workspace 6"
		},
		"<p>w7": {
			"name": "Workspace: 7",
			"shell": "aerospace workspace 7"
		},
		"<p>w8": {
			"name": "Workspace: 8",
			"shell": "aerospace workspace 8"
		},
		"<p>w9": {
			"name": "Workspace: 9",
			"shell": "aerospace workspace 9"
		},
		"<p>wl": {
			"name": "Workspace: Left (Display)",
			"shell": "aerospace move-workspace-to-monitor left"
		},
		"<p>wr": {
			"name": "Workspace: Right (Display)",
			"shell": "aerospace move-workspace-to-monitor right"
		},
		"<p>wu": {
			"name": "Workspace: Up (Display)",
			"shell": "aerospace move-workspace-to-monitor up"
		},
		"<p>wd": {
			"name": "Workspace: Down (Display)",
			"shell": "aerospace move-workspace-to-monitor down"
		},
		"?<p>m": { "name": "Move Window" },
		"<p>m0": {
			"name": "Move: (Workspace) 0",
			"shell": "aerospace move-node-to-workspace 0"
		},
		"<p>m1": {
			"name": "Move: (Workspace) 1",
			"shell": "aerospace move-node-to-workspace 1"
		},
		"<p>m2": {
			"name": "Move: (Workspace) 2",
			"shell": "aerospace move-node-to-workspace 2"
		},
		"<p>m3": {
			"name": "Move: (Workspace) 3",
			"shell": "aerospace move-node-to-workspace 3"
		},
		"<p>m4": {
			"name": "Move: (Workspace) 4",
			"shell": "aerospace move-node-to-workspace 4"
		},
		"<p>m5": {
			"name": "Move: (Workspace) 5",
			"shell": "aerospace move-node-to-workspace 5"
		},
		"<p>m6": {
			"name": "Move: (Workspace) 6",
			"shell": "aerospace move-node-to-workspace 6"
		},
		"<p>m7": {
			"name": "Move: (Workspace) 7",
			"shell": "aerospace move-node-to-workspace 7"
		},
		"<p>m8": {
			"name": "Move: (Workspace) 8",
			"shell": "aerospace move-node-to-workspace 8"
		},
		"<p>m9": {
			"name": "Move: (Workspace) 9",
			"shell": "aerospace move-node-to-workspace 9"
		},
		"<p>ml": {
			"name": "Move: Left (Display)",
			"shell": "aerospace move-node-to-monitor left"
		},
		"<p>mr": {
			"name": "Move: Right (Display)",
			"shell": "aerospace move-node-to-monitor right"
		},
		"<p>mu": {
			"name": "Move: Up (Display)",
			"shell": "aerospace move-node-to-monitor up"
		},
		"<p>md": {
			"name": "Move: Down (Display)",
			"shell": "aerospace move-node-to-monitor down"
		},
		"?<p>f": { "name": "Follow Window to Workspace" },
		"<p>f0": {
			"name": "Follow: (to workspace) 0",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 0"
		},
		"<p>f1": {
			"name": "Follow: (to workspace) 1",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 1"
		},
		"<p>f2": {
			"name": "Follow: (to workspace) 2",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 2"
		},
		"<p>f3": {
			"name": "Follow: (to workspace) 3",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 3"
		},
		"<p>f4": {
			"name": "Follow: (to workspace) 4",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 4"
		},
		"<p>f5": {
			"name": "Follow: (to workspace) 5",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 5"
		},
		"<p>f6": {
			"name": "Follow: (to workspace) 6",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 6"
		},
		"<p>f7": {
			"name": "Follow: (to workspace) 7",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 7"
		},
		"<p>f8": {
			"name": "Follow: (to workspace) 8",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 8"
		},
		"<p>f9": {
			"name": "Follow: (to workspace) 9",
			"shell": "aerospace move-node-to-workspace --focus-follows-window 9"
		},
		"?<p>d": { "name": "Display" },
		"<p>dw": {
			"name": "Display: West",
			"shell": "aerospace focus-monitor left"
		},
		"<p>de": {
			"name": "Display: East",
			"shell": "aerospace focus-monitor right"
		},
		"<p>dn": {
			"name": "Display: North",
			"shell": "aerospace focus-monitor up"
		},
		"<p>ds": {
			"name": "Display: South",
			"shell": "aerospace focus-monitor down"
		},
		"?<p>,": { "name": "AeroSpace Config" },
		"<p>,r": {
			"name": "AeroSpace: Reload",
			"shell": "aerospace reload-config"
		},
		"<p>,p": {
			"name": "AeroSpace: Play (Start)",
			"shell": "aerospace enable on"
		},
		"<p>,h": {
			"name": "AeroSpace: Halt (Stop)",
			"shell": "aerospace enable off"
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
	scripts,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, description, devDependencies, displayName, name, packageManager, repository, scripts, type };
