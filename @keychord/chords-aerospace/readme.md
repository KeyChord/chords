# @keychord/chords-aerospace

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Global `;` chords for the [AeroSpace](https://github.com/nikitabobko/AeroSpace) tiling
window manager. Each chord runs one `aerospace` command, so AeroSpace must be installed and
running, with `aerospace` on your login shell's `PATH`.

Install it from Settings → Browse (**AeroSpace Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-aerospace`.

The chords use the same keys as [`@keychord/chords-rift`](../chords-rift/readme.md), so
switching between the two window managers keeps your chords. Enable only one of the two.

Every chord starts with the same prefix, `;` by default. To use another key, such as `-`,
set **Window management prefix** under Settings → Chords → Placeholders; the table below
uses `;`. In [`chords/macos.toml`](./chords/macos.toml) the keys are written `'<p>q'`, and
the `[placeholders]` table declares `p` with its default. This needs a Chord with
placeholder support: older versions skip every `<p>` chord as an invalid key sequence.

| Chords                      | `aerospace` command                                                            |
| --------------------------- | ------------------------------------------------------------------------------ |
| `;w` `;e` `;n` `;s`         | `focus left` / `right` / `up` / `down`                                         |
| `;]` `;[`                   | `focus dfs-next` / `dfs-prev`                                                  |
| `;l` `;r` `;u` `;d`         | `move left` / `right` / `up` / `down`                                          |
| `;jl` `;jr` `;ju` `;jd`     | `join-with left` / `right` / `up` / `down`                                     |
| `;jx`                       | `flatten-workspace-tree` (unjoins every window in the workspace)               |
| `;vf` `;vs` `;vo`           | `layout floating tiling` / `accordion tiles` / `horizontal vertical` (toggles) |
| `;zf` `;zg`                 | `fullscreen --no-outer-gaps` / `fullscreen` (within the outer gaps)            |
| `;r=` `;r-`                 | `resize smart +50` / `-50`                                                     |
| `;rw=` `;rw-` `;rh=` `;rh-` | `resize width` / `height` `+50` / `-50`                                        |
| `;b`                        | `balance-sizes`                                                                |
| `;lt` `;ls`                 | `layout --root tiles` / `accordion` (the whole workspace)                      |
| `;lf`                       | `layout floating` (the focused window)                                         |
| `;w]` `;w[` `;wk`           | `workspace --no-stdin next` / `prev`, `workspace-back-and-forth`               |
| `;w0`–`;w9`                 | `workspace 0`–`9`                                                              |
| `;wl` `;wr` `;wu` `;wd`     | `move-workspace-to-monitor left` / `right` / `up` / `down`                     |
| `;m0`–`;m9` `;f0`–`;f9`     | `move-node-to-workspace 0`–`9`, with `--focus-follows-window` for `;f`         |
| `;ml` `;mr` `;mu` `;md`     | `move-node-to-monitor left` / `right` / `up` / `down`                          |
| `;dw` `;de` `;dn` `;ds`     | `focus-monitor left` / `right` / `up` / `down`                                 |
| `;q`                        | `close`                                                                        |
| `;v` `;,p` `;,h`            | `enable toggle` / `on` / `off` (whether AeroSpace manages windows)             |
| `;,r`                       | `reload-config`                                                                |

AeroSpace has no master/stack, BSP or scrolling layout, so Rift's `;m`, `;p`, `;lm…`, `;lb`,
`;lc` and `;c…` chords have no counterpart here. Workspace digits are AeroSpace workspace
names, not indexes: `;w2` focuses the workspace named `2`. Chord runs commands without a
terminal, and `workspace next|prev` then needs `--no-stdin`: without it, AeroSpace 0.20
and later reject the command as implicit stdin.

## Development

`vp run test` checks the bindings, including that every key is one chords-rift uses. When
`aerospace` is installed, it also runs every command through `sh -c` (as Chord does) inside
`sandbox-exec` with outbound connections denied. The CLI parses its arguments before
connecting, so a typo or an invalid argument fails the test, while a valid command stops at
the connection and can't reach a running AeroSpace.
