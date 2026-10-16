# @keychord/chords-navigation

Global macOS navigation through Accessibility. The app captured when chord mode
opens is brought forward before acting; a queued chord retains its own target.

- `[[`: go back, or dismiss the active dialog/popover with cancel or Escape.
- `]]`: press the default action, or the next/continue button in the header.
- `[x`: dismiss the dialog completely, including nested dialogs where possible.
- `]1`, `]2`, `]12`: press the numbered visible option. Numbering starts at 1,
  top to bottom and left to right within each row. Buttons, radio buttons,
  checkboxes, and menu items count; disabled choices keep their position and fail
  when selected. A focused list/grid is preferred outside dialogs.

Default/cancel/close accessibility relationships take priority. The header
fallback uses roles and bounds, assumes a left-to-right layout, and rejects
ambiguous controls. No button labels, help strings, or app-specific IDs are
matched. Dismissal prefers an accessibility cancel action, then sends Escape
only to the captured process. `[x` requires a dialog and never closes ordinary
application windows. If a dialog ignores dismissal, it fails instead of repeatedly
pressing Escape. Numbering includes only controls exposed in the current scope;
scroll unloaded options into view first.

Requires macOS 14+ and Chord's Accessibility permission. Build with `vp pack`;
run handler tests with `vp run test`. From the workspace root, run
`vp run test:macos -- @keychord/chords-navigation` for native regression checks,
including WhatsApp's group picker and wallpaper-style dialogs.
