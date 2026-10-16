# @keychord/chords-jetbrains

Chord package for JetBrains IDEs.

## Supported Apps

- CLion
- DataGrip
- GoLand
- IntelliJ IDEA
- PhpStorm
- PyCharm
- Rider
- RubyMine
- RustRover
- WebStorm

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Every IDE shares the chords in [`base.toml`](./chords/base.toml): editor `e`, tabs
`t`, find/file `f`, build `b`, split/search `s`, completion/code `c`, run `r`, diff
`d`, panels `p`, and zoom/zen `z`. Some chords send the IDE's default macOS keymap
shortcuts. Others run IDE actions by ID through the IDE's command-line launcher
(`ideScript`), which expects the IDE at the path set in its chord file, for example
`/Applications/IntelliJ IDEA.app/Contents/MacOS/idea`.

Install it from Settings → Browse (**JetBrains Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-jetbrains`.
