# @keychord/chords-com.apple.ScriptEditor2

Chords for Script Editor (`com.apple.ScriptEditor2`). Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[App bindings](./chords/com/apple/ScriptEditor2/macos.toml).

Build with `vp pack` and run `vp run test` for Bun tests. From the monorepo root,
run `CHORD_TESTING_VM_NAME=chords-testing-golden-gate node_modules/.bin/chordtest test @keychord/chords-com.apple.ScriptEditor2` for the macOS 27 VM tests.
