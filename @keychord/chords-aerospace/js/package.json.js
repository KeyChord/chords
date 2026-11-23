//#region package.json
var name = "@keychord/chords-aerospace";
var displayName = "AeroSpace Chords";
var version = "0.0.1";
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
var chords = {
	"macos.toml": {
		"name": "AeroSpace",
		"meta": {
			"chord": ">=0.3.0",
			"$wrap": false
		},
		"placeholders": { "<>": {
			"name": "Window management prefix",
			"default": "a"
		} },
		"chords": {
			"?<>": { "name": "AeroSpace" },
			"<>q": {
				"name": "Quit Window",
				"shell": "aerospace close"
			},
			"<>v": {
				"name": "Vary: AeroSpace On/Off",
				"shell": "aerospace enable toggle"
			},
			"<>w": {
				"name": "West (Window)",
				"shell": "aerospace focus left"
			},
			"<>e": {
				"name": "East (Window)",
				"shell": "aerospace focus right"
			},
			"<>n": {
				"name": "North (Window)",
				"shell": "aerospace focus up"
			},
			"<>s": {
				"name": "South (Window)",
				"shell": "aerospace focus down"
			},
			"<>]": {
				"name": "Next (Window)",
				"shell": "aerospace focus dfs-next"
			},
			"<>[": {
				"name": "Previous (Window)",
				"shell": "aerospace focus dfs-prev"
			},
			"<>l": {
				"name": "Left (Move Window)",
				"shell": "aerospace move left"
			},
			"<>r": {
				"name": "Right (Move Window)",
				"shell": "aerospace move right"
			},
			"<>u": {
				"name": "Up (Move Window)",
				"shell": "aerospace move up"
			},
			"<>d": {
				"name": "Down (Move Window)",
				"shell": "aerospace move down"
			},
			"?<>j": { "name": "Join" },
			"<>jl": {
				"name": "Join: Left",
				"shell": "aerospace join-with left"
			},
			"<>jr": {
				"name": "Join: Right",
				"shell": "aerospace join-with right"
			},
			"<>ju": {
				"name": "Join: Up",
				"shell": "aerospace join-with up"
			},
			"<>jd": {
				"name": "Join: Down",
				"shell": "aerospace join-with down"
			},
			"<>jx": {
				"name": "Join: Unjoin All (Flatten Workspace)",
				"shell": "aerospace flatten-workspace-tree"
			},
			"?<>v": { "name": "Vary" },
			"<>vf": {
				"name": "Vary: Floating",
				"shell": "aerospace layout floating tiling"
			},
			"<>vs": {
				"name": "Vary: Stacked (Accordion)",
				"shell": "aerospace layout accordion tiles"
			},
			"<>vo": {
				"name": "Vary: Orientation",
				"shell": "aerospace layout horizontal vertical"
			},
			"?<>z": { "name": "Zoom" },
			"<>zf": {
				"name": "Zoom: Fullscreen",
				"shell": "aerospace fullscreen --no-outer-gaps"
			},
			"<>zg": {
				"name": "Zoom: Fullscreen Within Gaps",
				"shell": "aerospace fullscreen"
			},
			"?<>r": { "name": "Resize" },
			"<>r=": {
				"name": "Resize: Increase",
				"shell": "aerospace resize smart +50"
			},
			"<>r-": {
				"name": "Resize: Decrease",
				"shell": "aerospace resize smart -50"
			},
			"<>rw=": {
				"name": "Resize: Increase Width",
				"shell": "aerospace resize width +50"
			},
			"<>rw-": {
				"name": "Resize: Decrease Width",
				"shell": "aerospace resize width -50"
			},
			"<>rh=": {
				"name": "Resize: Increase Height",
				"shell": "aerospace resize height +50"
			},
			"<>rh-": {
				"name": "Resize: Decrease Height",
				"shell": "aerospace resize height -50"
			},
			"<>b": {
				"name": "Balance Sizes",
				"shell": "aerospace balance-sizes"
			},
			"?<>l": { "name": "Left / Layout" },
			"<>lt": {
				"name": "Layout: Tiles",
				"shell": "aerospace layout --root tiles"
			},
			"<>ls": {
				"name": "Layout: Stack (Accordion)",
				"shell": "aerospace layout --root accordion"
			},
			"<>lf": {
				"name": "Layout: Floating (Window)",
				"shell": "aerospace layout floating"
			},
			"?<>w": { "name": "Workspace" },
			"<>w]": {
				"name": "Workspace: Next",
				"shell": "aerospace workspace --no-stdin next"
			},
			"<>w[": {
				"name": "Workspace: Previous",
				"shell": "aerospace workspace --no-stdin prev"
			},
			"<>wk": {
				"name": "Workspace: Back (Last Used)",
				"shell": "aerospace workspace-back-and-forth"
			},
			"<>w0": {
				"name": "Workspace: 0",
				"shell": "aerospace workspace 0"
			},
			"<>w1": {
				"name": "Workspace: 1",
				"shell": "aerospace workspace 1"
			},
			"<>w2": {
				"name": "Workspace: 2",
				"shell": "aerospace workspace 2"
			},
			"<>w3": {
				"name": "Workspace: 3",
				"shell": "aerospace workspace 3"
			},
			"<>w4": {
				"name": "Workspace: 4",
				"shell": "aerospace workspace 4"
			},
			"<>w5": {
				"name": "Workspace: 5",
				"shell": "aerospace workspace 5"
			},
			"<>w6": {
				"name": "Workspace: 6",
				"shell": "aerospace workspace 6"
			},
			"<>w7": {
				"name": "Workspace: 7",
				"shell": "aerospace workspace 7"
			},
			"<>w8": {
				"name": "Workspace: 8",
				"shell": "aerospace workspace 8"
			},
			"<>w9": {
				"name": "Workspace: 9",
				"shell": "aerospace workspace 9"
			},
			"<>wl": {
				"name": "Workspace: Left (Display)",
				"shell": "aerospace move-workspace-to-monitor left"
			},
			"<>wr": {
				"name": "Workspace: Right (Display)",
				"shell": "aerospace move-workspace-to-monitor right"
			},
			"<>wu": {
				"name": "Workspace: Up (Display)",
				"shell": "aerospace move-workspace-to-monitor up"
			},
			"<>wd": {
				"name": "Workspace: Down (Display)",
				"shell": "aerospace move-workspace-to-monitor down"
			},
			"?<>m": { "name": "Move Window" },
			"<>m0": {
				"name": "Move: (Workspace) 0",
				"shell": "aerospace move-node-to-workspace 0"
			},
			"<>m1": {
				"name": "Move: (Workspace) 1",
				"shell": "aerospace move-node-to-workspace 1"
			},
			"<>m2": {
				"name": "Move: (Workspace) 2",
				"shell": "aerospace move-node-to-workspace 2"
			},
			"<>m3": {
				"name": "Move: (Workspace) 3",
				"shell": "aerospace move-node-to-workspace 3"
			},
			"<>m4": {
				"name": "Move: (Workspace) 4",
				"shell": "aerospace move-node-to-workspace 4"
			},
			"<>m5": {
				"name": "Move: (Workspace) 5",
				"shell": "aerospace move-node-to-workspace 5"
			},
			"<>m6": {
				"name": "Move: (Workspace) 6",
				"shell": "aerospace move-node-to-workspace 6"
			},
			"<>m7": {
				"name": "Move: (Workspace) 7",
				"shell": "aerospace move-node-to-workspace 7"
			},
			"<>m8": {
				"name": "Move: (Workspace) 8",
				"shell": "aerospace move-node-to-workspace 8"
			},
			"<>m9": {
				"name": "Move: (Workspace) 9",
				"shell": "aerospace move-node-to-workspace 9"
			},
			"<>ml": {
				"name": "Move: Left (Display)",
				"shell": "aerospace move-node-to-monitor left"
			},
			"<>mr": {
				"name": "Move: Right (Display)",
				"shell": "aerospace move-node-to-monitor right"
			},
			"<>mu": {
				"name": "Move: Up (Display)",
				"shell": "aerospace move-node-to-monitor up"
			},
			"<>md": {
				"name": "Move: Down (Display)",
				"shell": "aerospace move-node-to-monitor down"
			},
			"?<>f": { "name": "Follow Window to Workspace" },
			"<>f0": {
				"name": "Follow: (to workspace) 0",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 0"
			},
			"<>f1": {
				"name": "Follow: (to workspace) 1",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 1"
			},
			"<>f2": {
				"name": "Follow: (to workspace) 2",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 2"
			},
			"<>f3": {
				"name": "Follow: (to workspace) 3",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 3"
			},
			"<>f4": {
				"name": "Follow: (to workspace) 4",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 4"
			},
			"<>f5": {
				"name": "Follow: (to workspace) 5",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 5"
			},
			"<>f6": {
				"name": "Follow: (to workspace) 6",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 6"
			},
			"<>f7": {
				"name": "Follow: (to workspace) 7",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 7"
			},
			"<>f8": {
				"name": "Follow: (to workspace) 8",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 8"
			},
			"<>f9": {
				"name": "Follow: (to workspace) 9",
				"shell": "aerospace move-node-to-workspace --focus-follows-window 9"
			},
			"?<>d": { "name": "Display" },
			"<>dw": {
				"name": "Display: West",
				"shell": "aerospace focus-monitor left"
			},
			"<>de": {
				"name": "Display: East",
				"shell": "aerospace focus-monitor right"
			},
			"<>dn": {
				"name": "Display: North",
				"shell": "aerospace focus-monitor up"
			},
			"<>ds": {
				"name": "Display: South",
				"shell": "aerospace focus-monitor down"
			},
			"?<>,": { "name": "AeroSpace Config" },
			"<>,r": {
				"name": "AeroSpace: Reload",
				"shell": "aerospace reload-config"
			},
			"<>,p": {
				"name": "AeroSpace: Play (Start)",
				"shell": "aerospace enable on"
			},
			"<>,h": {
				"name": "AeroSpace: Halt (Stop)",
				"shell": "aerospace enable off"
			}
		}
	},
	"windows.toml": {
		"name": "AeroSpace for Windows",
		"meta": {
			"chord": ">=0.3.4",
			"$wrap": false
		},
		"placeholders": { "<>": {
			"name": "Window management prefix",
			"default": "a"
		} },
		"chords": {
			"?<>": { "name": "AeroSpace" },
			"<>q": {
				"name": "Quit Window",
				"shell": "aerospace.exe close"
			},
			"<>v": {
				"name": "Vary: AeroSpace On/Off",
				"shell": "aerospace.exe enable toggle"
			},
			"<>w": {
				"name": "West (Window)",
				"shell": "aerospace.exe focus left"
			},
			"<>e": {
				"name": "East (Window)",
				"shell": "aerospace.exe focus right"
			},
			"<>n": {
				"name": "North (Window)",
				"shell": "aerospace.exe focus up"
			},
			"<>s": {
				"name": "South (Window)",
				"shell": "aerospace.exe focus down"
			},
			"<>]": {
				"name": "Next (Window)",
				"shell": "aerospace.exe focus dfs-next"
			},
			"<>[": {
				"name": "Previous (Window)",
				"shell": "aerospace.exe focus dfs-prev"
			},
			"<>l": {
				"name": "Left (Move Window)",
				"shell": "aerospace.exe move left"
			},
			"<>r": {
				"name": "Right (Move Window)",
				"shell": "aerospace.exe move right"
			},
			"<>u": {
				"name": "Up (Move Window)",
				"shell": "aerospace.exe move up"
			},
			"<>d": {
				"name": "Down (Move Window)",
				"shell": "aerospace.exe move down"
			},
			"?<>j": { "name": "Join" },
			"<>jl": {
				"name": "Join: Left",
				"shell": "aerospace.exe join-with left"
			},
			"<>jr": {
				"name": "Join: Right",
				"shell": "aerospace.exe join-with right"
			},
			"<>ju": {
				"name": "Join: Up",
				"shell": "aerospace.exe join-with up"
			},
			"<>jd": {
				"name": "Join: Down",
				"shell": "aerospace.exe join-with down"
			},
			"<>jx": {
				"name": "Join: Unjoin All (Flatten Workspace)",
				"shell": "aerospace.exe flatten-workspace-tree"
			},
			"?<>v": { "name": "Vary" },
			"<>vf": {
				"name": "Vary: Floating",
				"shell": "aerospace.exe layout floating tiling"
			},
			"<>vs": {
				"name": "Vary: Stacked (Accordion)",
				"shell": "aerospace.exe layout accordion tiles"
			},
			"<>vo": {
				"name": "Vary: Orientation",
				"shell": "aerospace.exe layout horizontal vertical"
			},
			"?<>z": { "name": "Zoom" },
			"<>zf": {
				"name": "Zoom: Fullscreen",
				"shell": "aerospace.exe fullscreen --no-outer-gaps"
			},
			"<>zg": {
				"name": "Zoom: Fullscreen Within Gaps",
				"shell": "aerospace.exe fullscreen"
			},
			"?<>r": { "name": "Resize" },
			"<>r=": {
				"name": "Resize: Increase",
				"shell": "aerospace.exe resize smart +50"
			},
			"<>r-": {
				"name": "Resize: Decrease",
				"shell": "aerospace.exe resize smart -50"
			},
			"<>rw=": {
				"name": "Resize: Increase Width",
				"shell": "aerospace.exe resize width +50"
			},
			"<>rw-": {
				"name": "Resize: Decrease Width",
				"shell": "aerospace.exe resize width -50"
			},
			"<>rh=": {
				"name": "Resize: Increase Height",
				"shell": "aerospace.exe resize height +50"
			},
			"<>rh-": {
				"name": "Resize: Decrease Height",
				"shell": "aerospace.exe resize height -50"
			},
			"<>b": {
				"name": "Balance Sizes",
				"shell": "aerospace.exe balance-sizes"
			},
			"?<>l": { "name": "Left / Layout" },
			"<>lt": {
				"name": "Layout: Tiles",
				"shell": "aerospace.exe layout --root tiles"
			},
			"<>ls": {
				"name": "Layout: Stack (Accordion)",
				"shell": "aerospace.exe layout --root accordion"
			},
			"<>lf": {
				"name": "Layout: Floating (Window)",
				"shell": "aerospace.exe layout floating"
			},
			"?<>w": { "name": "Workspace" },
			"<>w]": {
				"name": "Workspace: Next",
				"shell": "aerospace.exe workspace --no-stdin next"
			},
			"<>w[": {
				"name": "Workspace: Previous",
				"shell": "aerospace.exe workspace --no-stdin prev"
			},
			"<>wk": {
				"name": "Workspace: Back (Last Used)",
				"shell": "aerospace.exe workspace-back-and-forth"
			},
			"<>w0": {
				"name": "Workspace: 0",
				"shell": "aerospace.exe workspace 0"
			},
			"<>w1": {
				"name": "Workspace: 1",
				"shell": "aerospace.exe workspace 1"
			},
			"<>w2": {
				"name": "Workspace: 2",
				"shell": "aerospace.exe workspace 2"
			},
			"<>w3": {
				"name": "Workspace: 3",
				"shell": "aerospace.exe workspace 3"
			},
			"<>w4": {
				"name": "Workspace: 4",
				"shell": "aerospace.exe workspace 4"
			},
			"<>w5": {
				"name": "Workspace: 5",
				"shell": "aerospace.exe workspace 5"
			},
			"<>w6": {
				"name": "Workspace: 6",
				"shell": "aerospace.exe workspace 6"
			},
			"<>w7": {
				"name": "Workspace: 7",
				"shell": "aerospace.exe workspace 7"
			},
			"<>w8": {
				"name": "Workspace: 8",
				"shell": "aerospace.exe workspace 8"
			},
			"<>w9": {
				"name": "Workspace: 9",
				"shell": "aerospace.exe workspace 9"
			},
			"<>wl": {
				"name": "Workspace: Left (Display)",
				"shell": "aerospace.exe move-workspace-to-monitor left"
			},
			"<>wr": {
				"name": "Workspace: Right (Display)",
				"shell": "aerospace.exe move-workspace-to-monitor right"
			},
			"<>wu": {
				"name": "Workspace: Up (Display)",
				"shell": "aerospace.exe move-workspace-to-monitor up"
			},
			"<>wd": {
				"name": "Workspace: Down (Display)",
				"shell": "aerospace.exe move-workspace-to-monitor down"
			},
			"?<>m": { "name": "Move Window" },
			"<>m0": {
				"name": "Move: (Workspace) 0",
				"shell": "aerospace.exe move-node-to-workspace 0"
			},
			"<>m1": {
				"name": "Move: (Workspace) 1",
				"shell": "aerospace.exe move-node-to-workspace 1"
			},
			"<>m2": {
				"name": "Move: (Workspace) 2",
				"shell": "aerospace.exe move-node-to-workspace 2"
			},
			"<>m3": {
				"name": "Move: (Workspace) 3",
				"shell": "aerospace.exe move-node-to-workspace 3"
			},
			"<>m4": {
				"name": "Move: (Workspace) 4",
				"shell": "aerospace.exe move-node-to-workspace 4"
			},
			"<>m5": {
				"name": "Move: (Workspace) 5",
				"shell": "aerospace.exe move-node-to-workspace 5"
			},
			"<>m6": {
				"name": "Move: (Workspace) 6",
				"shell": "aerospace.exe move-node-to-workspace 6"
			},
			"<>m7": {
				"name": "Move: (Workspace) 7",
				"shell": "aerospace.exe move-node-to-workspace 7"
			},
			"<>m8": {
				"name": "Move: (Workspace) 8",
				"shell": "aerospace.exe move-node-to-workspace 8"
			},
			"<>m9": {
				"name": "Move: (Workspace) 9",
				"shell": "aerospace.exe move-node-to-workspace 9"
			},
			"<>ml": {
				"name": "Move: Left (Display)",
				"shell": "aerospace.exe move-node-to-monitor left"
			},
			"<>mr": {
				"name": "Move: Right (Display)",
				"shell": "aerospace.exe move-node-to-monitor right"
			},
			"<>mu": {
				"name": "Move: Up (Display)",
				"shell": "aerospace.exe move-node-to-monitor up"
			},
			"<>md": {
				"name": "Move: Down (Display)",
				"shell": "aerospace.exe move-node-to-monitor down"
			},
			"?<>f": { "name": "Follow Window to Workspace" },
			"<>f0": {
				"name": "Follow: (to workspace) 0",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 0"
			},
			"<>f1": {
				"name": "Follow: (to workspace) 1",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 1"
			},
			"<>f2": {
				"name": "Follow: (to workspace) 2",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 2"
			},
			"<>f3": {
				"name": "Follow: (to workspace) 3",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 3"
			},
			"<>f4": {
				"name": "Follow: (to workspace) 4",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 4"
			},
			"<>f5": {
				"name": "Follow: (to workspace) 5",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 5"
			},
			"<>f6": {
				"name": "Follow: (to workspace) 6",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 6"
			},
			"<>f7": {
				"name": "Follow: (to workspace) 7",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 7"
			},
			"<>f8": {
				"name": "Follow: (to workspace) 8",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 8"
			},
			"<>f9": {
				"name": "Follow: (to workspace) 9",
				"shell": "aerospace.exe move-node-to-workspace --focus-follows-window 9"
			},
			"?<>d": { "name": "Display" },
			"<>dw": {
				"name": "Display: West",
				"shell": "aerospace.exe focus-monitor left"
			},
			"<>de": {
				"name": "Display: East",
				"shell": "aerospace.exe focus-monitor right"
			},
			"<>dn": {
				"name": "Display: North",
				"shell": "aerospace.exe focus-monitor up"
			},
			"<>ds": {
				"name": "Display: South",
				"shell": "aerospace.exe focus-monitor down"
			},
			"?<>,": { "name": "AeroSpace Config" },
			"<>,r": {
				"name": "AeroSpace: Reload",
				"shell": "aerospace.exe reload-config"
			},
			"<>,p": {
				"name": "AeroSpace: Play (Start)",
				"shell": "aerospace.exe enable on"
			},
			"<>,h": {
				"name": "AeroSpace: Halt (Stop)",
				"shell": "aerospace.exe enable off"
			}
		}
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
