//#region package.json
var name = "@keychord/chords-terminal";
var displayName = "Terminal Chords";
var version = "0.0.1";
var description = "Tab chords for basic terminals: Terminal, iTerm2, Ghostty, WezTerm, Alacritty and Hyper.";
var categories = ["Terminals"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-terminal"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"base.toml": {
		"name": "Terminal Tabs",
		"chords": {
			"?t": { "name": "Tab" },
			"t1": {
				"name": "Tab 1",
				"shortcut": "cmd+1"
			},
			"t2": {
				"name": "Tab 2",
				"shortcut": "cmd+2"
			},
			"t3": {
				"name": "Tab 3",
				"shortcut": "cmd+3"
			},
			"t4": {
				"name": "Tab 4",
				"shortcut": "cmd+4"
			},
			"t5": {
				"name": "Tab 5",
				"shortcut": "cmd+5"
			},
			"t6": {
				"name": "Tab 6",
				"shortcut": "cmd+6"
			},
			"t7": {
				"name": "Tab 7",
				"shortcut": "cmd+7"
			},
			"t8": {
				"name": "Tab 8",
				"shortcut": "cmd+8"
			}
		}
	},
	"co": { "zeit": { "hyper": {
		"linux.toml": {
			"name": "Hyper",
			"executables": ["hyper"],
			"import": [{ "file": "tabs-ctrl.desktop.toml" }]
		},
		"macos.toml": {
			"name": "Hyper",
			"import": [{ "file": "base.toml" }]
		},
		"windows.toml": {
			"name": "Hyper",
			"executables": ["Hyper.exe"],
			"import": [{ "file": "tabs-ctrl.desktop.toml" }]
		}
	} } },
	"com": {
		"apple": { "Terminal": { "macos.toml": {
			"name": "Terminal",
			"import": [{ "file": "base.toml" }],
			"chords": { "t9": {
				"name": "Tab 9",
				"shortcut": "cmd+9"
			} }
		} } },
		"github": { "wez": { "wezterm": {
			"linux.toml": {
				"name": "WezTerm",
				"executables": ["wezterm-gui"],
				"import": [{ "file": "tabs-ctrl-shift.desktop.toml" }]
			},
			"macos.toml": {
				"name": "WezTerm",
				"import": [{ "file": "base.toml" }]
			},
			"windows.toml": {
				"name": "WezTerm",
				"executables": ["wezterm-gui.exe"],
				"import": [{ "file": "tabs-ctrl-shift.desktop.toml" }]
			}
		} } },
		"googlecode": { "iterm2": { "macos.toml": {
			"name": "iTerm2",
			"import": [{ "file": "base.toml" }]
		} } },
		"microsoft": { "WindowsTerminal": { "windows.toml": {
			"name": "Windows Terminal",
			"executables": ["WindowsTerminal.exe"],
			"chords": {
				"?t": { "name": "Tab" },
				"t1": {
					"name": "Tab 1",
					"shortcut": "ctrl+alt+1"
				},
				"t2": {
					"name": "Tab 2",
					"shortcut": "ctrl+alt+2"
				},
				"t3": {
					"name": "Tab 3",
					"shortcut": "ctrl+alt+3"
				},
				"t4": {
					"name": "Tab 4",
					"shortcut": "ctrl+alt+4"
				},
				"t5": {
					"name": "Tab 5",
					"shortcut": "ctrl+alt+5"
				},
				"t6": {
					"name": "Tab 6",
					"shortcut": "ctrl+alt+6"
				},
				"t7": {
					"name": "Tab 7",
					"shortcut": "ctrl+alt+7"
				},
				"t8": {
					"name": "Tab 8",
					"shortcut": "ctrl+alt+8"
				}
			}
		} } },
		"mitchellh": { "ghostty": {
			"linux.toml": {
				"name": "Ghostty",
				"executables": ["ghostty", "com.mitchellh.ghostty"],
				"import": [{ "file": "tabs-alt.desktop.toml" }]
			},
			"macos.toml": {
				"name": "Ghostty",
				"import": [{ "file": "base.toml" }]
			}
		} }
	},
	"macos.toml": {
		"name": "Terminal",
		"chords": {}
	},
	"org": {
		"alacritty": { "macos.toml": {
			"name": "Alacritty",
			"import": [{ "file": "base.toml" }]
		} },
		"gnome": { "Terminal": { "linux.toml": {
			"name": "GNOME Terminal",
			"executables": ["gnome-terminal-server", "Gnome-terminal"],
			"import": [{ "file": "tabs-alt.desktop.toml" }],
			"chords": { "t9": {
				"name": "Tab 9",
				"shortcut": "alt+9"
			} }
		} } }
	},
	"tabs-alt.desktop.toml": {
		"name": "Terminal Tabs",
		"chords": {
			"?t": { "name": "Tab" },
			"t1": {
				"name": "Tab 1",
				"shortcut": "alt+1"
			},
			"t2": {
				"name": "Tab 2",
				"shortcut": "alt+2"
			},
			"t3": {
				"name": "Tab 3",
				"shortcut": "alt+3"
			},
			"t4": {
				"name": "Tab 4",
				"shortcut": "alt+4"
			},
			"t5": {
				"name": "Tab 5",
				"shortcut": "alt+5"
			},
			"t6": {
				"name": "Tab 6",
				"shortcut": "alt+6"
			},
			"t7": {
				"name": "Tab 7",
				"shortcut": "alt+7"
			},
			"t8": {
				"name": "Tab 8",
				"shortcut": "alt+8"
			}
		}
	},
	"tabs-ctrl-shift.desktop.toml": {
		"name": "Terminal Tabs",
		"chords": {
			"?t": { "name": "Tab" },
			"t1": {
				"name": "Tab 1",
				"shortcut": "ctrl+shift+1"
			},
			"t2": {
				"name": "Tab 2",
				"shortcut": "ctrl+shift+2"
			},
			"t3": {
				"name": "Tab 3",
				"shortcut": "ctrl+shift+3"
			},
			"t4": {
				"name": "Tab 4",
				"shortcut": "ctrl+shift+4"
			},
			"t5": {
				"name": "Tab 5",
				"shortcut": "ctrl+shift+5"
			},
			"t6": {
				"name": "Tab 6",
				"shortcut": "ctrl+shift+6"
			},
			"t7": {
				"name": "Tab 7",
				"shortcut": "ctrl+shift+7"
			},
			"t8": {
				"name": "Tab 8",
				"shortcut": "ctrl+shift+8"
			}
		}
	},
	"tabs-ctrl.desktop.toml": {
		"name": "Terminal Tabs",
		"chords": {
			"?t": { "name": "Tab" },
			"t1": {
				"name": "Tab 1",
				"shortcut": "ctrl+1"
			},
			"t2": {
				"name": "Tab 2",
				"shortcut": "ctrl+2"
			},
			"t3": {
				"name": "Tab 3",
				"shortcut": "ctrl+3"
			},
			"t4": {
				"name": "Tab 4",
				"shortcut": "ctrl+4"
			},
			"t5": {
				"name": "Tab 5",
				"shortcut": "ctrl+5"
			},
			"t6": {
				"name": "Tab 6",
				"shortcut": "ctrl+6"
			},
			"t7": {
				"name": "Tab 7",
				"shortcut": "ctrl+7"
			},
			"t8": {
				"name": "Tab 8",
				"shortcut": "ctrl+8"
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
