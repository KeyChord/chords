# @keychord/chords-aerospace

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Global `;a` chords for the [AeroSpace](https://github.com/nikitabobko/AeroSpace) tiling
window manager. Each chord runs one `aerospace` command, so AeroSpace must be installed and
running, with `aerospace` on your login shell's `PATH`.

Install it from Settings → Browse (**AeroSpace Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-aerospace`.

The keys after the prefix follow the same layout as [`@keychord/chords-rift`](../chords-rift/readme.md).

Every chord starts with the same prefix, `;a` by default. To use another key, such as `-`,
set **Window management prefix** under Settings → Chords → Placeholders; the table below
uses `;a`. In [`chords/macos.toml`](./chords/macos.toml) the keys are written `'<>q'`, and
the `[placeholders]` table declares `p` with its default. This needs a Chord with
placeholder support: older versions skip every `<>` chord as an invalid key sequence.

| Chords                          | `aerospace` command                                                            |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `;aw` `;ae` `;an` `;as`         | `focus left` / `right` / `up` / `down`                                         |
| `;a]` `;a[`                     | `focus dfs-next` / `dfs-prev`                                                  |
| `;al` `;ar` `;au` `;ad`         | `move left` / `right` / `up` / `down`                                          |
| `;ajl` `;ajr` `;aju` `;ajd`     | `join-with left` / `right` / `up` / `down`                                     |
| `;ajx`                          | `flatten-workspace-tree` (unjoins every window in the workspace)               |
| `;avf` `;avs` `;avo`            | `layout floating tiling` / `accordion tiles` / `horizontal vertical` (toggles) |
| `;azf` `;azg`                   | `fullscreen --no-outer-gaps` / `fullscreen` (within the outer gaps)            |
| `;ar=` `;ar-`                   | `resize smart +50` / `-50`                                                     |
| `;arw=` `;arw-` `;arh=` `;arh-` | `resize width` / `height` `+50` / `-50`                                        |
| `;ab`                           | `balance-sizes`                                                                |
| `;alt` `;als`                   | `layout --root tiles` / `accordion` (the whole workspace)                      |
| `;alf`                          | `layout floating` (the focused window)                                         |
| `;aw]` `;aw[` `;awk`            | `workspace --no-stdin next` / `prev`, `workspace-back-and-forth`               |
| `;aw0`–`;aw9`                   | `workspace 0`–`9`                                                              |
| `;awl` `;awr` `;awu` `;awd`     | `move-workspace-to-monitor left` / `right` / `up` / `down`                     |
| `;am0`–`;am9` `;af0`–`;af9`     | `move-node-to-workspace 0`–`9`, with `--focus-follows-window` for `;af`        |
| `;aml` `;amr` `;amu` `;amd`     | `move-node-to-monitor left` / `right` / `up` / `down`                          |
| `;adw` `;ade` `;adn` `;ads`     | `focus-monitor left` / `right` / `up` / `down`                                 |
| `;aq`                           | `close`                                                                        |
| `;av` `;a,p` `;a,h`             | `enable toggle` / `on` / `off` (whether AeroSpace manages windows)             |
| `;a,r`                          | `reload-config`                                                                |

AeroSpace has no master/stack, BSP or scrolling layout, so Rift's `;am`, `;ap`, `;alm…`, `;alb`,
`;alc` and `;ac…` chords have no counterpart here. Workspace digits are AeroSpace workspace
names, not indexes: `;aw2` focuses the workspace named `2`. Chord runs commands without a
terminal, and `workspace next|prev` then needs `--no-stdin`: without it, AeroSpace 0.20
and later reject the command as implicit stdin.

## Development

`vp run test` checks the bindings, including that every key is one chords-rift uses. When
`aerospace` is installed, it also runs every command through `sh -c` (as Chord does) inside
`sandbox-exec` with outbound connections denied. The CLI parses its arguments before
connecting, so a typo or an invalid argument fails the test, while a valid command stops at
the connection and can't reach a running AeroSpace.
