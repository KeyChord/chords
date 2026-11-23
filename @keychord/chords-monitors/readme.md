# @keychord/chords-monitors

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Monitor focusing for macOS, Linux X11, and Windows. To install, in [Chord](https://github.com/KeyChord/Chord)
open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, then
tick `@keychord/chords-monitors` under **Packages to use**.

Every chord starts with the package's `<>` prefix, `;m` by default. To reach them with fewer
keys, choose another prefix under Settings → Chords → **Placeholders**, and use the same one for `@keychord/chords-betterdisplay`. The examples
below use the default.

| Chord           | Result                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| `;m1`, `;m2`, … | Focus the numbered monitor (primary display first, then system display order) |
| `;m[` / `;m]`   | Focus the previous / next monitor, wrapping at either end                     |
| `;ml` / `;mr`   | Focus the nearest monitor to the left / right                                 |
| `;mt` / `;mb`   | Focus the nearest monitor above / below                                       |

Monitor commands start from the display containing the pointer. They move the pointer to the
target display's center and focus its frontmost eligible window without clicking or moving any
windows. On an empty display, only the pointer moves. Directional commands report an error
when there is no monitor in that direction.

- macOS requires Accessibility access.
- Linux requires an X11 session with an EWMH-compatible window manager, plus `xrandr`, `xdotool`,
  `xprop`, and `wmctrl`.
- Windows uses Win32 desktop APIs. If Windows declines a foreground activation, the pointer
  still moves to the selected display and Chord reports the focus failure.

Monitor resolution commands (`;md<width>x<height>`) are provided by
[`@keychord/chords-betterdisplay`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-betterdisplay), including
custom desktop sizes through BetterDisplay virtual-screen mirroring.
