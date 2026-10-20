# @keychord/chords-terminal

Tab chords for basic terminals. Warp has its own package,
[`chords-warp`](../chords-warp).

| Chord | Result |
| --- | --- |
| `/t` (global) | Open Terminal |
| `t1` … `t8` | Switch to tab 1 … 8 (Command-1 … Command-8) |
| `t9` | Switch to tab 9 (Command-9), in Terminal only |

Every terminal below imports the shared [tab chords](./chords/base.toml), which press each
terminal's default shortcut:

- [Terminal](./chords/com/apple/Terminal/macos.toml) (`com.apple.Terminal`): turn on
  Settings → General → **Use ⌘-1 through ⌘-9 to switch tabs**.
- [iTerm2](./chords/com/googlecode/iterm2/macos.toml) (`com.googlecode.iterm2`)
- [Ghostty](./chords/com/mitchellh/ghostty/macos.toml) (`com.mitchellh.ghostty`)
- [WezTerm](./chords/com/github/wez/wezterm/macos.toml) (`com.github.wez.wezterm`)
- [Alacritty](./chords/org/alacritty/macos.toml) (`org.alacritty`): tabs need Alacritty 0.13 or later.
- [Hyper](./chords/co/zeit/hyper/macos.toml) (`co.zeit.hyper`)

These terminals use Command-9 for their last tab rather than tab 9, so only Terminal binds
`t9`. kitty isn't included: its Command-1 … Command-9 select split panes, not tabs.

To install it, add the `KeyChord/chords` monorepo under Settings → Chords → Chord Monorepos and
tick `@keychord/chords-terminal`.

Build with `vp pack`. Run `vp run test` for Bun tests or
`vp run test:macos -- @keychord/chords-terminal` from the monorepo root for VM tests.
