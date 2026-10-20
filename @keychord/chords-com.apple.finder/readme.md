# @keychord/chords-com.apple.finder

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chord package for Finder (`com.apple.finder`). To install it, add the
`KeyChord/chords` monorepo under Settings → Chords → Chord Monorepos and tick
`@keychord/chords-com.apple.finder`.

The global chord `/f` opens Finder. While Finder or a file open/save dialog is
focused, the
[Finder chords](./chords/com/apple/finder/macos.toml) use `g` for navigation, `d`
for directories, `f` for files, `a` for view modes, `s` for sorting, `c` for
cleanup, and `t` for toggles and emptying the Trash. Most of them send Finder's own
keyboard shortcuts.

Build with `vp pack` in this directory. Run the package smoke test from the
monorepo root with `vp run test:macos -- @keychord/chords-com.apple.finder`.
