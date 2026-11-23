# @keychord/chords-com.apple.Automator

Chords for Automator (`com.apple.Automator`). Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[App bindings](./chords/com/apple/Automator/macos.toml).

Build with `vp pack` and run `vp run test` for Bun tests. From the monorepo root,
run `CHORD_TESTING_VM_NAME=chords-testing-golden-gate node_modules/.bin/chordtest test @keychord/chords-com.apple.Automator` for the macOS 27 VM tests.
