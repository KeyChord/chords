# @keychord/chords-spaces

macOS Space navigation shortcuts for Chord.

To move the current window between Spaces, `chords-windows` provides `/ws<number>`,
`/ws]` (next), and `/ws[` (previous).

| Chord          | Result                           |
| -------------- | -------------------------------- |
| `/s[` or `/sl` | Switch to the Space on the left  |
| `/s]` or `/sr` | Switch to the Space on the right |
| `/s1` … `/s9`  | Switch to Desktop 1 … 9          |

Space commands use the standard Control–Left/Right and Control–1…9 shortcuts.
Enable the matching actions under System Settings → Keyboard → Keyboard Shortcuts →
Mission Control; numbered desktops must already exist. Customized system shortcuts
need matching changes in `chords/macos.toml`.
