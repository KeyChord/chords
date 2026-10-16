# @keychord/chords-vscode

Chord handlers for VSCode and VSCode forks. Currently supports:

- [VSCode](./chords/com/microsoft/VSCode/macos.toml)
- [Cursor](./chords/com/todesktop/230313mzl4w4u92/macos.toml)

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

## Install

In [Chord](https://github.com/KeyChord/Chord), open Settings → Chords → **Chord Monorepos** →
**Add Monorepo**, enter `KeyChord/chords`, then tick `@keychord/chords-vscode` under
**Packages to use**. That loads the version documented here. Settings → Browse also lists this
package, but that adds its standalone repository, which can be older than this readme.

## How the chords run

Cursor imports the VSCode chord file, so both editors get the same chords. Most chords press
VSCode's default keyboard shortcuts, so they assume default keybindings. The few without a
default shortcut (`fpa`, `fpr`, `fnn`, `fh`, `fd`, `fs`, `fuc`, `es`, `tn`, `tt`, `gd`, `gy`,
`wqo`, `wt`, `dd`) run their VSCode command through the
[Command Server](https://marketplace.visualstudio.com/items?itemName=pokey.command-server)
extension: the handler writes the command to `$TMPDIR/vscode-command-server-<uid>/request.json`
and presses Command-Shift-F17, the extension's default keybinding. Install the extension in the
editor to use them; without it, those chords do nothing.
