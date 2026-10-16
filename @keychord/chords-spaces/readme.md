# @keychord/chords-spaces

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

macOS Space navigation shortcuts for Chord. To install, in [Chord](https://github.com/KeyChord/Chord)
open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, then
tick `@keychord/chords-spaces` under **Packages to use**.

To move the current window between Spaces, `chords-windows` provides `/ws<number>`,
`/ws]` (next), and `/ws[` (previous).

| Chord          | Result                           |
| -------------- | -------------------------------- |
| `/s[` or `/sl` | Switch to the Space on the left  |
| `/s]` or `/sr` | Switch to the Space on the right |
| `/s1` … `/s9`  | Switch to Desktop 1 … 9          |

Space commands use the standard Control–Left/Right and Control–1…9 shortcuts.
Enable the matching actions under System Settings → Keyboard → Keyboard Shortcuts →
Mission Control; numbered desktops must already exist. If you changed those system
shortcuts, redefine these chords to match in your own chord package.
