# @keychord/chords-finder

Chord package for Finder (`com.apple.finder`), extracted from
[`@keychord/chords-com.apple`](../chords-com.apple/readme.md).

[Finder chords](./chords/com/apple/finder/macos.toml) include `/f` to open Finder,
`g` for navigation, `d` for directories, `f` for files, `a` for view modes, `s` for
sorting, `c` for cleanup, and `t` for toggles and emptying the Trash.

Build with `vp pack` in this directory. Run the package smoke test from the
monorepo root with `vp run test:macos -- @keychord/chords-finder`.
