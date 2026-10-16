# @keychord/chords-monitors

Native macOS monitor focusing for Chord.

| Chord           | Result                                                                       |
| --------------- | ---------------------------------------------------------------------------- |
| `/m1`, `/m2`, … | Focus the numbered monitor (primary display first, then macOS display order) |
| `/m[` / `/m]`   | Focus the previous / next monitor, wrapping at either end                    |
| `/ml` / `/mr`   | Focus the nearest monitor to the left / right                                |
| `/mt` / `/mb`   | Focus the nearest monitor above / below                                      |

Monitor commands start from the display containing the pointer. They move the pointer
to the target display's usable center and focus its frontmost accessible visible window,
without clicking or moving windows. On an empty display, only the pointer moves.
Directional commands report an error when there is no monitor in that direction.
Monitor focusing requires Accessibility access. `/m` minimizes the current window when `@keychord/chords-windows` is installed.

Monitor resolution commands (`/ms<width>x<height>`) are provided by
[`@keychord/chords-betterdisplay`](../chords-betterdisplay/readme.md), including
custom desktop sizes through BetterDisplay virtual-screen mirroring.
