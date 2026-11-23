# @keychord/chords-com.apple.findmy

> [!WARNING]
> **EXPERIMENTAL**
>
> This package was largely created with AI and will be reviewed by a human later.

Chords for Find My (`com.apple.findmy`). Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[App bindings](./chords/com/apple/findmy/macos.toml).

Build with `vp pack` and run `vp run test` for Bun tests. Run the macOS 27 VM tests
from the monorepo root.

```sh
CHORD_TESTING_VM_NAME=chords-testing-golden-gate /usr/bin/lockf -k ~/.local/share/chords-testing/swarm-vm.lock \
  node_modules/.bin/chordtest test @keychord/chords-com.apple.findmy
```
