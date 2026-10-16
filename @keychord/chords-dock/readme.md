# @keychord/chords-dock

Chord package for the macOS Dock.

| Chord          | Result                  |
| -------------- | ----------------------- |
| `/dv`          | Toggle Dock focus       |
| `/dw]`         | Focus the next app      |
| `/dw[`         | Focus the previous app  |
| `/d<number>`   | Focus a Dock item       |
| `/d.<number>.` | Click a Dock item       |
| `/d.,<number>` | Right-click a Dock item |

`/dw]` and `/dw[` cycle through running Dock applications in both directions,
wrapping around. They use native macOS application activation independently of
the Command-Tab shortcut, including hidden apps and apps on other Spaces. The
initial order comes from window stacking, followed by apps without windows;
subsequent app activations update the recent-app order. Repeated chord switches
retain a stable cycle so every app remains reachable. Background helpers are skipped.

Window commands (including `/h`, `/m`, `/q` and their `/w` aliases) live in
[`@keychord/chords-windows`](../chords-windows/readme.md), monitor focusing in
[`@keychord/chords-monitors`](../chords-monitors/readme.md), and Space navigation in
[`@keychord/chords-spaces`](../chords-spaces/readme.md). Install those packages to
keep using their commands.
