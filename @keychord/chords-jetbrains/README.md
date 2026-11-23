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

On Linux and Windows, every IDE imports [`base.desktop.toml`](./chords/base.desktop.toml).
Select **Default for XWin** in the IDE's Keymap settings on Linux or the
[predefined Windows keymap](https://www.jetbrains.com/help/idea/reference-keymap-win-default.html)
on Windows. The chords cover default shortcuts for the editor, tabs, search,
files, builds, code, Git, debugging, diffs, and tool windows. Actions that need
JetBrains scripting, such as pinning specific tabs and choosing an exact folding
level, are available on macOS.

On macOS, [`base.toml`](./chords/base.toml) mixes default shortcuts with actions
invoked through the IDE's `ideScript` launcher. The launcher path comes from
each IDE's chord file, for example `/Applications/IntelliJ IDEA.app/Contents/MacOS/idea`.

Install it from Settings → Browse (**JetBrains Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-jetbrains`.
