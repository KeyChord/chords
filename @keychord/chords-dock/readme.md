# @keychord/chords-dock

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chord package for the macOS Dock. To install it, add the `KeyChord/chords` monorepo
under Settings → Chords → Chord Monorepos and tick `@keychord/chords-dock`.

| Chord          | Result                                       |
| -------------- | -------------------------------------------- |
| `/dv`          | Move keyboard focus to the Dock (Control-F3) |
| `/dw]`         | Focus the next app                           |
| `/dw[`         | Focus the previous app                       |
| `/d<number>`   | Same as `/dv`; the number isn't used         |
| `/d.<number>.` | Same as `/dv`; the number isn't used         |
| `/d.,<number>` | Same as `/dv`; the number isn't used         |

`/dv` and the numbered chords press Control-F3, macOS's "Move focus to the Dock"
keyboard shortcut, so that shortcut must be enabled in System Settings → Keyboard →
Keyboard Shortcuts → Keyboard.

`/dw]` and `/dw[` cycle through running Dock applications in both directions,
wrapping around. They use native macOS application activation independently of
the Command-Tab shortcut, including hidden apps and apps on other Spaces. The
initial order comes from window stacking, followed by apps without windows;
subsequent app activations update the recent-app order. Repeated chord switches
retain a stable cycle so every app remains reachable. Background helpers are skipped.

Window commands (including `/wh`, `/wm` and `/wq`) live in
[`@keychord/chords-windows`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-windows),
monitor focusing in
[`@keychord/chords-monitors`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-monitors),
and Space navigation in
[`@keychord/chords-spaces`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-spaces).
