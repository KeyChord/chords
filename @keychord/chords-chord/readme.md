# @keychord/chords-chord

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chord's own controls, in the `0` namespace. Chord bundles this package's
[chord file](./chords/com/leonsilicon/chord/macos.toml) and always loads it, so
there's nothing to install, and it can't be removed, disabled or overridden. Other
packages can't define chords in the `0` namespace.

| Chord                 | Result                                  |
| --------------------- | --------------------------------------- |
| `0,`                  | Open Chord's settings                   |
| `0,r`                 | Reload chords and stop active loops     |
| `0q`                  | Quit Chord                              |
| `0ls` or `0lsl`       | Use the left sidebar layout             |
| `0lf` or `0lfb`       | Use the bottom floating layout          |
| `0lv`                 | Cycle between the layouts               |
| `0h<ID>`              | Halt the loop with that ID, e.g. `0h12` |
| `0b<digit><sequence>` | Save a temporary buffer, numbered 1–9   |
| `0=<name>=<sequence>` | Save a named macro                      |

Leading digits before any chord set its repeat count. See Chord's
[scripting.md](https://github.com/KeyChord/Chord/blob/dev/scripting.md) for repeat
counts, loops, buffers and macros.
