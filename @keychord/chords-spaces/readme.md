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

## Linux X11

Install `wmctrl` and use an X11 window manager that supports EWMH workspaces. [wmctrl documentation](https://wiki.freedesktop.org/Software/wmctrl/)

| Chord           | Result                                            |
| --------------- | ------------------------------------------------- |
| `;d[` or `;dl`  | Switch to the previous workspace                  |
| `;d]` or `;dr`  | Switch to the next workspace                      |
| `;d1` … `;d9`   | Switch to Workspace 1 … 9                         |
| `;dm[` / `;dm]` | Move the window to the previous or next workspace |
| `;dm1` … `;dm9` | Move the window to Workspace 1 … 9                |

Numbered destinations must already exist. Move chords act on the window focused when the chord
started and leave you on your current workspace. Relative actions stop at the first or last
workspace.

## Windows

| Chord          | Result                             |
| -------------- | ---------------------------------- |
| `;d[` or `;dl` | Switch to the desktop on the left  |
| `;d]` or `;dr` | Switch to the desktop on the right |
| `;dv`          | Open Task View                     |
| `;dn`          | Create a desktop                   |
| `;dq`          | Close the current desktop          |

Use Task View to select a specific desktop or move a window to one. [Windows virtual desktop shortcuts](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows)
