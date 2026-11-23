# @keychord/chords-vscode

Chords for VS Code and Cursor on macOS, Linux, and Windows. The Linux and Windows
files also recognize VS Code Insiders.

## Install

In [Chord](https://github.com/KeyChord/Chord), open Settings → Chords → **Chord Monorepos** →
**Add Monorepo**, enter `KeyChord/chords`, then tick `@keychord/chords-vscode` under
**Packages to use**. That loads the version documented here. Settings → Browse also lists this
package, but that adds its standalone repository, which can be older than this readme.

## How the chords run

Cursor imports the VS Code chord file for the same platform. Most chords send
the platform's default shortcut and expect the relevant editor, terminal, or
panel to have focus. Cursor and user keybinding overrides can change those defaults.
[VS Code default keyboard shortcuts](https://code.visualstudio.com/docs/reference/default-keybindings)

Install the Command Server extension in each editor to use bindings marked
`@input:command` in the Linux and Windows TOML files. Keep its default temporary
directory and Ctrl+Shift+Alt+P binding. The macOS handler uses Command+Shift+F17.
[Command Server](https://marketplace.visualstudio.com/items?itemName=pokey.command-server)
