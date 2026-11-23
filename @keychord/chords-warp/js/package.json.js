//#region package.json
var name = "@keychord/chords-warp";
var displayName = "Warp Chords";
var version = "0.0.2";
var description = "Chords for the Warp terminal.";
var categories = ["Terminals"];
var repository = {
	"type": "git",
	"url": "https://github.com/KeyChord/chords-warp"
};
var type = "module";
var scripts = { "test": "bun test --isolate" };
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
	"dev": { "warp": { "Warp-Stable": {
		"desktop.toml": {
			"meta": { "url": "https://docs.warp.dev/getting-started/keyboard-shortcuts" },
			"on": { "command": {
				"type": "js",
				"file": "warp.js",
				"args": ["configured"]
			} },
			"chords": {
				"?f": { "name": "Find" },
				"f": {
					"name": "Find",
					"@input:command": ["terminal:find", "ctrl+shift+f"]
				},
				"f]": {
					"name": "Find: Next Match",
					"@input:command": ["find:find_next_occurrence", "f3"]
				},
				"f[": {
					"name": "Find: Previous Match",
					"@input:command": ["find:find_prev_occurrence", "shift+f3"]
				},
				"?b": { "name": "Block" },
				"ba": {
					"name": "Block: Select All",
					"@input:command": ["terminal:select_all_blocks", "ctrl+shift+a"]
				},
				"bs": {
					"name": "Block: Share",
					"@input:command": ["terminal:open_share_block_modal", "ctrl+shift+s"]
				},
				"bc": {
					"name": "Block: Clear All",
					"@input:command": ["terminal:clear_blocks", "ctrl+shift+k"]
				},
				"bm": {
					"name": "Block: Menu",
					"@input:command": ["terminal:open_block_list_context_menu_via_keybinding"]
				},
				"b[": {
					"name": "Block: Previous",
					"@input:command": ["terminal:select_previous_block", "ctrl+up"]
				},
				"b]": {
					"name": "Block: Next",
					"@input:command": ["terminal:select_next_block", "ctrl+down"]
				},
				"bu": {
					"name": "Block: Expand Selection Up",
					"@input:command": ["terminal:expand_block_selection_above", "shift+up"]
				},
				"bd": {
					"name": "Block: Expand Selection Down",
					"@input:command": ["terminal:expand_block_selection_below", "shift+down"]
				},
				"?c": { "name": "Command" },
				"co": {
					"name": "Command: Copy Output",
					"@input:command": ["terminal:copy_outputs", "ctrl+shift+alt+c"]
				},
				"cr": {
					"name": "Command: Reinput",
					"@input:command": ["terminal:reinput_commands", "ctrl+shift+i"]
				},
				"cc": {
					"name": "Command: Copy",
					"@input:command": ["terminal:copy_commands", "ctrl+shift+c"]
				},
				"cp": {
					"name": "Command: Palette",
					"@input:command": ["workspace:toggle_command_palette", "ctrl+shift+p"]
				},
				"cs": {
					"name": "Command: Search",
					"@input:command": ["workspace:show_command_search", "ctrl+r"]
				},
				"?m": { "name": "Mark" },
				"mb": {
					"name": "Mark: Bookmark Block",
					"@input:command": ["terminal:bookmark_selected_block", "ctrl+shift+b"]
				},
				"mu": {
					"name": "Mark: Previous Bookmark",
					"@input:command": ["terminal:select_bookmark_up", "alt+up"]
				},
				"md": {
					"name": "Mark: Next Bookmark",
					"@input:command": ["terminal:select_bookmark_down", "alt+down"]
				},
				"?t": { "name": "Tab" },
				"tn": {
					"name": "Tab: New",
					"@input:command": ["workspace:new_tab", "ctrl+shift+t"]
				},
				"tq": {
					"name": "Close Current Pane or Tab",
					"shortcut": "ctrl+shift+w"
				},
				"to": {
					"name": "Tab: Reopen Closed",
					"@input:command": ["app:reopen_closed_session", "ctrl+alt+t"]
				},
				"t1": {
					"name": "Switch to Tab 1",
					"@input:command": ["workspace:activate_first_tab", "ctrl+1"]
				},
				"t2": {
					"name": "Switch to Tab 2",
					"@input:command": ["workspace:activate_second_tab", "ctrl+2"]
				},
				"t3": {
					"name": "Switch to Tab 3",
					"@input:command": ["workspace:activate_third_tab", "ctrl+3"]
				},
				"t4": {
					"name": "Switch to Tab 4",
					"@input:command": ["workspace:activate_fourth_tab", "ctrl+4"]
				},
				"t5": {
					"name": "Switch to Tab 5",
					"@input:command": ["workspace:activate_fifth_tab", "ctrl+5"]
				},
				"t6": {
					"name": "Switch to Tab 6",
					"@input:command": ["workspace:activate_sixth_tab", "ctrl+6"]
				},
				"t7": {
					"name": "Switch to Tab 7",
					"@input:command": ["workspace:activate_seventh_tab", "ctrl+7"]
				},
				"t8": {
					"name": "Switch to Tab 8",
					"@input:command": ["workspace:activate_eighth_tab", "ctrl+8"]
				},
				"t9": {
					"name": "Switch to Last Tab",
					"@input:command": ["workspace:activate_last_tab", "ctrl+9"]
				},
				"t[": {
					"name": "Switch to Previous Tab",
					"@input:command": ["workspace:activate_prev_tab", "ctrl+pageup"]
				},
				"t]": {
					"name": "Switch to Next Tab",
					"@input:command": ["workspace:activate_next_tab", "ctrl+pagedown"]
				},
				"tl": {
					"name": "Move Current Tab Left",
					"@input:command": ["workspace:move_tab_left", "ctrl+shift+left"]
				},
				"tr": {
					"name": "Move Current Tab Right",
					"@input:command": ["workspace:move_tab_right", "ctrl+shift+right"]
				},
				"?s": { "name": "Split / Scroll" },
				"sn": {
					"name": "Split: Focus Up",
					"@input:command": ["pane_group:navigate_up", "ctrl+alt+up"]
				},
				"se": {
					"name": "Split: Focus Right",
					"@input:command": ["pane_group:navigate_right", "ctrl+alt+right"]
				},
				"ss": {
					"name": "Split: Focus Down",
					"@input:command": ["pane_group:navigate_down", "ctrl+alt+down"]
				},
				"sw": {
					"name": "Split: Focus Left",
					"@input:command": ["pane_group:navigate_left", "ctrl+alt+left"]
				},
				"sd": {
					"name": "Split: Down",
					"@input:command": ["pane_group:add_down", "ctrl+shift+e"]
				},
				"sr": {
					"name": "Split: Right",
					"@input:command": ["pane_group:add_right", "ctrl+shift+d"]
				},
				"sm": {
					"name": "Split: Toggle Maximize Pane",
					"@input:command": ["pane_group:toggle_maximize_pane", "ctrl+shift+enter"]
				},
				"s[": {
					"name": "Split: Previous Pane",
					"@input:command": ["pane_group:navigate_prev", "ctrl+shift+["]
				},
				"s]": {
					"name": "Split: Next Pane",
					"@input:command": ["pane_group:navigate_next", "ctrl+shift+]"]
				},
				"slu": {
					"name": "Scroll Up One Line",
					"@input:command": ["terminal:scroll_up_one_line"]
				},
				"sld": {
					"name": "Scroll Down One Line",
					"@input:command": ["terminal:scroll_down_one_line"]
				},
				"spu": {
					"name": "Scroll Up One Page",
					"@input:command": ["terminal:scroll_up_one_page", "pageup"]
				},
				"spd": {
					"name": "Scroll Down One Page",
					"@input:command": ["terminal:scroll_down_one_page", "pagedown"]
				},
				"st": {
					"name": "Scroll to Top",
					"shortcut": "home"
				},
				"sb": {
					"name": "Scroll to Bottom",
					"shortcut": "end"
				},
				"?r": { "name": "Resize Pane" },
				"ru": {
					"name": "Resize Pane Up",
					"@input:command": ["pane_group:resize_up"]
				},
				"rd": {
					"name": "Resize Pane Down",
					"@input:command": ["pane_group:resize_down"]
				},
				"rr": {
					"name": "Resize Pane Right",
					"@input:command": ["pane_group:resize_right"]
				},
				"rl": {
					"name": "Resize Pane Left",
					"@input:command": ["pane_group:resize_left"]
				},
				"?z": { "name": "Zoom" },
				"zi": {
					"name": "Increase Font Size",
					"@input:command": ["workspace:increase_font_size", "ctrl+="]
				},
				"zo": {
					"name": "Decrease Font Size",
					"@input:command": ["workspace:decrease_font_size", "ctrl+-"]
				},
				"zr": {
					"name": "Reset Font Size",
					"@input:command": ["workspace:reset_font_size", "ctrl+0"]
				},
				"?p": { "name": "Panel" },
				"pd": {
					"name": "Panel: Drive",
					"@input:command": ["workspace:toggle_warp_drive", "ctrl+shift+backslash"]
				},
				"?i": { "name": "Input" },
				"im": {
					"name": "Input: Mouse Reporting",
					"@input:command": ["workspace:toggle_mouse_reporting"]
				},
				"in": {
					"name": "Input: Natural Language",
					"@input:command": ["input:toggle_natural_language_command_search", "ctrl+backtick"]
				},
				"if": {
					"name": "Input: Focus Terminal",
					"@input:command": ["terminal:focus_input", "ctrl+shift+l"]
				},
				"iw": {
					"name": "Input: Workflows",
					"@input:command": ["input:toggle_workflows", "ctrl+shift+r"]
				},
				"is": {
					"name": "Input: Warpify Subshell",
					"@input:command": ["terminal:warpify_subshell", "ctrl+i"]
				}
			}
		},
		"linux.toml": {
			"name": "Warp",
			"executables": ["warp-terminal", "dev.warp.Warp"],
			"import": [{ "file": "desktop.toml" }]
		},
		"macos.toml": {
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
		},
		"windows.toml": {
			"name": "Warp",
			"executables": ["warp.exe"],
			"import": [{ "file": "desktop.toml" }]
		}
	} } },
	"macos.toml": {
		"name": "Terminal",
		"chords": {}
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
	dependencies,
	devDependencies,
	packageManager,
	chords
};
//#endregion
export { categories, chords, package_default as default, dependencies, description, devDependencies, displayName, name, packageManager, repository, scripts, type, version };
