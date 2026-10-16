//#region package.json
var name = "@keychord/chords-terminal";
var version = "0.0.0";
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-terminal"
};
var type = "module";
var imports = { "#/*": "./src/js/*" };
var dependencies = {
	"array-uniq": "latest",
	"brace-expansion": "latest",
	"js-yaml": "latest",
	"just-zip-it": "latest"
};
var devDependencies = {
	"@keychord/chordtest": "workspace:*",
	"@keychord/config": "catalog:",
	"@keychord/tsconfig": "catalog:",
	"@types/js-yaml": "latest"
};
var packageManager = "pnpm@12.11.2";
var chords = {
	"dev": { "warp": { "Warp-Stable": { "macos.toml": {
		"name": "Warp",
		"meta": { "url": "https://docs.warp.dev/getting-started/keyboard-shortcuts" },
		"on": { "command": {
			"type": "js",
			"file": "warp.js",
			"args": []
		} },
		"chords": {
			"?f": { "name": "Find" },
			"f]": {
				"name": "Find: Next Match",
				"@input:command": ["editor:previous_find_match"]
			},
			"f[": {
				"name": "Find: Next Match",
				"@input:command": ["editor:next_find_match"]
			},
			"?b": { "name": "Block" },
			"ba": {
				"name": "Block: All Select",
				"@input:command": ["terminal:select_all_blocks"],
				"shortcut": "cmd+a"
			},
			"bs": {
				"name": "Block: Share",
				"@input:command": ["terminal:open_share_modal"],
				"shortcut": "shift+cmd+s"
			},
			"bc": {
				"name": "Block: Clear All",
				"@input:command": ["terminal:clear_blocks"],
				"shortcut": "cmd+k"
			},
			"bm": {
				"name": "Block: Menu",
				"@input:command": ["terminal:open_block_list_context_menu_via_keybinding"],
				"shortcut": "cmd+m"
			},
			"b[": {
				"name": "Block: Previous",
				"@input:command": ["terminal:select_previous_block"],
				"shortcut": "cmd+up"
			},
			"b]": {
				"name": "Block: Next",
				"@input:command": ["terminal:select_next_block"],
				"shortcut": "cmd+down"
			},
			"bu": {
				"name": "Block: Up Expand Selected Blocks Above",
				"@input:command": ["terminal:expand_block_selection_above"],
				"shortcut": "shift+cmd+up"
			},
			"bd": {
				"name": "Block: Down Expand Selected Blocks Below",
				"@input:command": ["terminal:expand_block_selection_below"],
				"shortcut": "shift+cmd+down"
			},
			"?c": { "name": "Command" },
			"co": {
				"name": "Command: Output Copy",
				"@input:command": ["terminal:copy_outputs"],
				"shortcut": "alt+shift+cmd+c"
			},
			"cr": {
				"name": "Command: Reinput",
				"@input:command": ["terminal:reinput_commands"],
				"shortcut": "cmd+i"
			},
			"cc": {
				"name": "Command: Copy",
				"@input:command": ["terminal:copy_commands"],
				"shortcut": "shift+cmd+c"
			},
			"crr": {
				"name": "Command: Reinput as Root",
				"@input:command": ["terminal:reinput_commands_with_sudo"],
				"shortcut": "shift+cmd+i"
			},
			"cp": {
				"name": "Command: Palette",
				"@input:command": ["terminal:open_command_palette"],
				"shortcut": "cmd+p"
			},
			"cs": {
				"name": "Command: Search",
				"@input:command": ["workspace:show_command_search"],
				"shortcut": "ctrl+r"
			},
			"?m": { "name": "Mark" },
			"mb": {
				"name": "Mark: Block",
				"@input:command": ["terminal:bookmark_selected_block"],
				"shortcut": "cmd+b"
			},
			"mu": {
				"name": "Mark: Up",
				"@input:command": ["terminal:select_bookmark_up"],
				"shortcut": "alt+up"
			},
			"md": {
				"name": "Mark: Down",
				"@input:command": ["terminal:select_bookmark_down"],
				"shortcut": "alt+down"
			},
			"?t": { "name": "Tab" },
			"td": {
				"name": "Tab: Duplicate",
				"@input:command": ["workspace:duplicate_tab"],
				"shortcut": "shift+cmd+d"
			},
			"tn": {
				"name": "Tab: New",
				"@input:command": ["workspace:new_tab"],
				"shortcut": "cmd+t"
			},
			"tq": {
				"name": "Tab: Quit",
				"@input:command": ["workspace:close_current_tab"],
				"shortcut": "cmd+w"
			},
			"to": {
				"name": "Tab: Open Closed",
				"@input:command": ["workspace:reopen_closed_tab"],
				"shortcut": "shift+cmd+t"
			},
			"tqr": {
				"name": "Tab: Quit to Right",
				"@input:command": ["workspace:close_tabs_right_active_tab"],
				"shortcut": "shift+cmd+t"
			},
			"tqo": {
				"name": "Tab: Quit Others",
				"@input:command": ["workspace:close_other_tabs"],
				"shortcut": "shift+cmd+t"
			},
			"t1": {
				"name": "Switch to tab 1",
				"@input:command": ["workspace:switch_tab:0"],
				"shortcut": "cmd+1"
			},
			"t2": {
				"name": "Switch to tab 2",
				"@input:command": ["workspace:switch_tab:1"],
				"shortcut": "cmd+2"
			},
			"t3": {
				"name": "Switch to tab 3",
				"@input:command": ["workspace:switch_tab:2"],
				"shortcut": "cmd+3"
			},
			"t4": {
				"name": "Switch to tab 4",
				"@input:command": ["workspace:switch_tab:3"],
				"shortcut": "cmd+4"
			},
			"t5": {
				"name": "Switch to tab 5",
				"@input:command": ["workspace:switch_tab:4"],
				"shortcut": "cmd+5"
			},
			"t6": {
				"name": "Switch to tab 6",
				"@input:command": ["workspace:switch_tab:5"],
				"shortcut": "cmd+6"
			},
			"t7": {
				"name": "Switch to tab 7",
				"@input:command": ["workspace:switch_tab:6"],
				"shortcut": "cmd+7"
			},
			"t8": {
				"name": "Switch to tab 8",
				"@input:command": ["workspace:switch_tab:7"],
				"shortcut": "cmd+8"
			},
			"t[": {
				"name": "Switch to previous tab",
				"@input:command": ["workspace:previous_tab"],
				"shortcut": "ctrl+shift+tab"
			},
			"t]": {
				"name": "Switch to next tab",
				"@input:command": ["workspace:next_tab"],
				"shortcut": "ctrl+tab"
			},
			"tl": {
				"name": "Move current tab left",
				"@input:command": ["workspace:move_tab_left"],
				"shortcut": "shift+cmd+["
			},
			"tr": {
				"name": "Move current tab right",
				"@input:command": ["workspace:move_tab_right"],
				"shortcut": "shift+cmd+]"
			},
			"?s": { "name": "Split / Scroll" },
			"sn": {
				"name": "Split: North",
				"@input:command": ["pane_group:focus_up"],
				"shortcut": "cmd+alt+up"
			},
			"se": {
				"name": "Split: East",
				"@input:command": ["pane_group:focus_right"],
				"shortcut": "cmd+alt+right"
			},
			"ss": {
				"name": "Split: South",
				"@input:command": ["pane_group:focus_down"],
				"shortcut": "cmd+alt+down"
			},
			"sw": {
				"name": "Split: West",
				"@input:command": ["pane_group:focus_left"],
				"shortcut": "cmd+alt+left"
			},
			"su": {
				"name": "Split: Up",
				"@input:command": ["pane_group:add_up"]
			},
			"sd": {
				"name": "Split: Down",
				"@input:command": ["pane_group:add_down"],
				"shortcut": "cmd+shift+d"
			},
			"sr": {
				"name": "Split: Right",
				"@input:command": ["pane_group:add_right"],
				"shortcut": "cmd+d"
			},
			"sl": {
				"name": "Split: Left",
				"@input:command": ["pane_group:add_left"]
			},
			"slu": {
				"name": "Scroll Terminal Output Up One Line",
				"@input:command": ["terminal:scroll_line_up"]
			},
			"sld": {
				"name": "Scroll Terminal Output Down One Line",
				"@input:command": ["terminal:scroll_line_down"]
			},
			"spu": {
				"name": "Scroll Up One Page",
				"@input:command": ["terminal:page_up"],
				"shortcut": "pageup"
			},
			"spd": {
				"name": "Scroll Down One Page",
				"@input:command": ["terminal:page_down"],
				"shortcut": "pagedown"
			},
			"st": {
				"name": "Scroll to Top",
				"@input:command": ["terminal:scroll_home"],
				"shortcut": "shift+cmd+up"
			},
			"sb": {
				"name": "Scroll to Bottom",
				"@input:command": ["terminal:scroll_end"],
				"shortcut": "shift+cmd+down"
			},
			"?r": { "name": "Resize" },
			"ru": {
				"name": "Resize: Up",
				"@input:command": ["pane_group:resize_up"],
				"shortcut": "ctrl+cmd+up"
			},
			"rd": {
				"name": "Resize: Down",
				"@input:command": ["pane_group:resize_down"],
				"shortcut": "ctrl+cmd+down"
			},
			"rr": {
				"name": "Resize: Right",
				"@input:command": ["pane_group:resize_right"],
				"shortcut": "ctrl+cmd+right"
			},
			"rl": {
				"name": "Resize: Left",
				"@input:command": ["pane_group:resize_left"],
				"shortcut": "ctrl+cmd+left"
			},
			"?z": { "name": "Zoom" },
			"zi": {
				"name": "Increase font size",
				"@input:command": ["window:increase_font_size"],
				"shortcut": "cmd+="
			},
			"zo": {
				"name": "Decrease font size",
				"@input:command": ["window:decrease_font_size"],
				"shortcut": "cmd+-"
			},
			"zr": {
				"name": "Reset font size",
				"@input:command": ["window:reset_font_size"]
			},
			"zf": {
				"name": "Zoom: Full Screen",
				"@input:command": ["root_view:toggle_fullscreen"]
			},
			"?p": { "name": "Panel" },
			"pa": {
				"name": "Panel: AI",
				"@input:command": ["workspace:toggle_ai_panel"],
				"shortcut": "ctrl+]"
			},
			"pt": {
				"name": "Panel: Theme",
				"@input:command": ["workspace:show_theme_chooser"],
				"shortcut": "ctrl+cmd+t"
			},
			"pd": {
				"name": "Panel: Drive",
				"@input:command": ["terminal:toggle_warp_drive"],
				"shortcut": "cmd+backslash"
			},
			"?i": { "name": "Input" },
			"im": {
				"name": "Input: Mouse Reporting",
				"@input:command": ["workspace:toggle_mouse_reporting"]
			},
			"in": {
				"name": "Input: Natural Language",
				"@input:command": ["input:toggle_natural_language_command_search"],
				"shortcut": "ctrl+shift+g"
			},
			"if": {
				"name": "Input: Focus Terminal",
				"@input:command": ["terminal:focus_input"],
				"shortcut": "cmd+l"
			},
			"iw": {
				"name": "Input: Workflows",
				"@input:command": ["input:toggle_workflows"],
				"shortcut": "ctrl+shift+r"
			},
			"is": {
				"name": "Input: Subshell",
				"@input:command": ["terminal:trigger_subshell_bootstrap"],
				"shortcut": "ctrl+i"
			}
		}
	} } } },
	"macos.toml": {
		"name": "Terminal",
		"chords": { "/w": {
			"name": "Warp",
			"command": "Open Warp",
			"shell": "open -a 'Warp'"
		} }
	}
};
var package_default = {
	name,
	version,
	repository,
	type,
	imports,
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { chords, package_default as default, dependencies, devDependencies, imports, name, packageManager, repository, type, version };
