# @keychord/chords-aerospace

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Global `.` chords for the [AeroSpace](https://github.com/nikitabobko/AeroSpace) tiling
window manager. Each chord runs an `aerospace` CLI command, so AeroSpace must be
installed and running, with `aerospace` on your login shell's `PATH`.

Install it from Settings → Browse (**AeroSpace Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-aerospace`.

| Chords                              | AeroSpace command                                                           |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `.w` `.e` `.n` `.s`                 | `focus left` / `right` / `up` / `down`                                      |
| `.l` `.r` `.u` `.d`                 | `move left` / `right` / `up` / `down`                                       |
| `.[`                                | `focus-back-and-forth`, falling back to `workspace-back-and-forth`          |
| `.f[` `.f]` `.f0`–`.f9` `.fa`–`.fz` | `workspace prev` / `next` / `0`–`9` / `A`–`Z`                               |
| `.m[` `.m]` `.m0`–`.m9` `.ma`–`.mz` | `move-node-to-workspace prev` / `next` / `0`–`9` / `a`–`z`                  |
| `.dw` `.de` `.dn` `.ds` `.d[` `.d]` | `focus-monitor --wrap-around` left / right / up / down / prev / next        |
| `.dl` `.dr` `.du` `.dd` `.dk` `.df` | `move-node-to-monitor --wrap-around` left / right / up / down / prev / next |
| `.tl` `.tr` `.tu` `.td` `.t[` `.t]` | `move-workspace-to-monitor` left / right / up / down / prev / next          |
| `.jl` `.jr` `.ju` `.jd`             | `join-with left` / `right` / `up` / `down`                                  |
| `.sl` `.sr` `.su` `.sd` `.s]` `.s[` | `swap left` / `right` / `up` / `down` / `dfs-next` / `dfs-prev`             |
| `.r-` `.r=`                         | `resize smart -10` / `+10`                                                  |
| `.rs` `.re`                         | `resize smart-opposite -10` / `+10`                                         |
| `.lt` `.lm`                         | `layout tiling`                                                             |
| `.zf` `.zfn` `.zm`                  | `fullscreen` / `macos-native-fullscreen` / `macos-native-minimize`          |
| `.q` `.qa`                          | `close` / `close-all-windows-but-current`                                   |
| `.v`                                | `enable toggle`                                                             |

[`chords/macos.toml`](./chords/macos.toml) also defines chords that aren't in this
table, such as `.cd`, `.p<workspace>`, `.wf`, the other `.l` layouts and `.rl`.
Those either run no command or don't run the command their name describes.
