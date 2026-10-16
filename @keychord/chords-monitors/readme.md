# @keychord/chords-monitors

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Native macOS monitor focusing for Chord. To install, in [Chord](https://github.com/KeyChord/Chord)
open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, then
tick `@keychord/chords-monitors` under **Packages to use**.

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
Monitor focusing requires Accessibility access.

Monitor resolution commands (`/md<width>x<height>`) are provided by
[`@keychord/chords-betterdisplay`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-betterdisplay), including
custom desktop sizes through BetterDisplay virtual-screen mirroring.
