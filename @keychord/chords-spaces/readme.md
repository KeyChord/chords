# @keychord/chords-spaces

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

macOS Space navigation shortcuts for Chord. To install, in [Chord](https://github.com/KeyChord/Chord)
open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, then
tick `@keychord/chords-spaces` under **Packages to use**.

Every chord starts with the package's `<>` prefix, `;s` by default. To reach them with fewer
keys, choose another prefix under Settings → Chords → **Placeholders**. The examples
below use the default.

To move the current window between Spaces, `chords-windows` provides `;ws<number>`,
`;ws]` (next), and `;ws[` (previous).

| Chord          | Result                           |
| -------------- | -------------------------------- |
| `;s[` or `;sl` | Switch to the Space on the left  |
| `;s]` or `;sr` | Switch to the Space on the right |
| `;s1` … `;s9`  | Switch to Desktop 1 … 9          |

Chord selects Spaces in Mission Control via macOS Accessibility. Mission Control briefly
appears during a switch. Numbered desktops must already exist. Left and right follow
the current display's Space order, including fullscreen Spaces, and stop at its edges.
