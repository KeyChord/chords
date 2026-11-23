# @keychord/chords-dock

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chord package for the macOS Dock. To install it, add the `KeyChord/chords` monorepo
under Settings → Chords → Chord Monorepos and tick `@keychord/chords-dock`.

Every chord starts with the package's `<>` prefix, `;d` by default. To reach them with fewer
keys, choose another prefix under Settings → Chords → **Placeholders**. The examples
below use the default.

| Chord          | Result                                       |
| -------------- | -------------------------------------------- |
| `;dv`          | Move keyboard focus to the Dock (Control-F3) |
| `;dw]`         | Focus the next app                           |
| `;dw[`         | Focus the previous app                       |
| `;d<number>`   | Focus the numbered Dock item                 |
| `;d.<number>.` | Open the numbered Dock item                  |
| `;d.,<number>` | Show the item's context menu                 |

`;dv` uses macOS's Control-F3 shortcut. Enable "Move focus to the Dock" under
System Settings → Keyboard → Keyboard Shortcuts → Keyboard. Numbered chords
use Accessibility and start at the first Dock item.

`;dw]` and `;dw[` cycle through running Dock applications in both directions,
wrapping around. They use native macOS application activation independently of
the Command-Tab shortcut, including hidden apps and apps on other Spaces. The
initial order comes from window stacking, followed by apps without windows;
subsequent app activations update the recent-app order. Repeated chord switches
retain a stable cycle so every app remains reachable. Background helpers are skipped.

Window commands (including `;bwh`, `;bwm` and `;bwq`) live in `@keychord/chords-menu` and
[`@keychord/chords-windows`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-windows),
monitor focusing in
[`@keychord/chords-monitors`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-monitors),
and Space navigation in
[`@keychord/chords-spaces`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-spaces).
