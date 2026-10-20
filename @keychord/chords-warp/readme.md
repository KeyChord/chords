# @keychord/chords-warp

Chord package for the [Warp](https://www.warp.dev/) terminal. For other terminals, see
[`chords-terminal`](../chords-terminal).

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

## Chords

- [Warp](./chords/dev/warp/Warp-Stable/macos.toml) (`dev.warp.Warp-Stable`): chords for find (`f`),
  blocks (`b`), commands (`c`), bookmarks (`m`), tabs (`t`), splits and scrolling (`s`), pane
  resizing (`r`), font size and full screen (`z`), panels (`p`), and input (`i`). Most of them
  press Warp's default keyboard shortcuts, so they assume Warp's default keybindings. The rest
  (`f[`, `f]`, `su`, `sl`, `slu`, `sld`, `zr`, `zf`, `im`) press the key bound to their Warp action in
  `~/.warp/keybindings.yaml`, and do nothing if there is none.
- `/w` (global): open Warp.

When Chord loads the package, the Warp handler re-saves `~/.warp/keybindings.yaml`, creating it
if needed. Existing bindings are kept, but comments and formatting are not.

## Install

In [Chord](https://github.com/KeyChord/Chord), open Settings → Chords → **Chord Monorepos** →
**Add Monorepo**, enter `KeyChord/chords`, then tick `@keychord/chords-warp` under
**Packages to use**. That loads the version documented here. Settings → Browse also lists this
package, but that adds its standalone repository, which can be older than this readme.

## Development

Run `vp pack` to build the `js/` directory:

```shell
vp pack
```
