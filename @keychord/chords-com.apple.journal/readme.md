# @keychord/chords-com.apple.journal

Chords for Journal (`com.apple.journal`). Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[App bindings](./chords/com/apple/journal/macos.toml).

Build with `vp pack` and run `vp run test` for Bun tests. Run the macOS 27 VM tests
from the monorepo root.

```sh
CHORD_TESTING_VM_NAME=chords-testing-golden-gate /usr/bin/lockf -k ~/.local/share/chords-testing/swarm-vm.lock \
  node_modules/.bin/chordtest test @keychord/chords-com.apple.journal
```
