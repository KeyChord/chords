# @keychord/chords-rift

Global `;` chords for the [Rift](https://github.com/acsandmann/rift) tiling window
manager. Each chord runs one `rift-cli execute` command (`;m` runs two, through a small
handler), so Rift must be installed and running, with `rift-cli` on your login shell's `PATH` (Homebrew's
`brew install acsandmann/tap/rift` puts it in `/opt/homebrew/bin`). When Rift isn't
running, the chord fails. A command that doesn't apply, such as a master chord in another
layout mode, does nothing: Rift reports success for every command it receives.

Install it from Settings → Browse (**Rift Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-rift`.
AeroSpace's package uses the same `;` layout, so enable only one of the two.

Every chord starts with the same prefix, `;` by default. To use another key, such as `-`,
set **Window management prefix** under Settings → Chords → Placeholders; the table below
uses `;`. In [`chords/macos.toml`](./chords/macos.toml) the keys are written `'<p>q'`, and
the `[placeholders]` table declares `p` with its default. This needs a Chord with
placeholder support: older versions skip every `<p>` chord as an invalid key sequence.

| Chords                              | `rift-cli execute` command                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `;w` `;e` `;n` `;s`                 | `window focus left` / `right` / `up` / `down`                                                                   |
| `;m`                                | `window focus --window-id` with the first visible window in the master area, found with `rift-cli query layout` |
| `;g]` `;g[`                         | `window next` / `prev`                                                                                          |
| `;gf`                               | `layout toggle-focus-float` (between floating and tiled windows)                                                |
| `;o` `;i`                           | `layout ascend` / `descend` (select the parent container / back down)                                           |
| `;l` `;r` `;u` `;d`                 | `layout move-node left` / `right` / `up` / `down`                                                               |
| `;p`                                | `layout promote-to-master` (moves the window into the master area, like `;lmp`)                                 |
| `;jl` `;jr` `;ju` `;jd` `;jx`       | `layout join-window left` / `right` / `up` / `down`, `layout unjoin`                                            |
| `;vf` `;vs` `;vo`                   | `window toggle-float`, `layout toggle-stack`, `layout toggle-orientation`                                       |
| `;zf` `;zg`                         | `window toggle-fullscreen` / `toggle-fullscreen-within-gaps`                                                    |
| `;r=` `;r-`                         | `window resize-grow` / `resize-shrink --orientation smart`                                                      |
| `;rw=` `;rw-` `;rh=` `;rh-`         | the same with `--orientation horizontal` (width) / `vertical` (height)                                          |
| `;b`                                | `layout balance` (also redraws a broken layout)                                                                 |
| `;lt` `;lb` `;ls` `;lm` `;lc` `;lf` | `workspace set-layout traditional` / `bsp` / `stack` / `master_stack` / `scrolling` / `floating`                |
| `;lml` `;lmr`                       | `config set settings.layout.master_stack.master_side left` / `right`, then `workspace set-layout master_stack`  |
| `;lmp` `;lms`                       | `layout promote-to-master` / `swap-master-stack`                                                                |
| `;lm=` `;lm-` `;lmc=` `;lmc-`       | `layout adjust-master-ratio ±0.05` / `adjust-master-count ±1`                                                   |
| `;cc` `;cw]` `;cw[`                 | `layout center-selection`, `layout switch-preset-column-width [--backwards]`                                    |
| `;f]` `;f[` `;fk`                   | `workspace next` / `prev` / `last` (the previously used workspace)                                              |
| `;f0`–`;f9`                         | `workspace switch 0`–`9`                                                                                        |
| `;m0`–`;m9` `;mf0`–`;mf9`           | `workspace move-window 0`–`9`, with `--follow` for `;mf`                                                        |
| `;dw` `;de` `;dn` `;ds`             | `display focus --direction left` / `right` / `up` / `down`                                                      |
| `;dl` `;dr` `;du` `;dd`             | `display move-window --direction left` / `right` / `up` / `down`                                                |
| `;tl` `;tr` `;tu` `;td`             | `display move-workspace --direction left` / `right` / `up` / `down`                                             |
| `;q`                                | `window close` (Rift sends Command-W to the focused window's app)                                               |
| `;v`                                | `space toggle-activated` (whether Rift manages the current macOS Space)                                         |
| `;,r`                               | `config reload`                                                                                                 |

Workspace digits are Rift's 0-based workspace indexes, the numbers its `rift-cli` and
`switch_to_workspace = N` key bindings use: `;f0` focuses the first workspace. Rift's
menu bar and default workspace names count from 1, so `;f2` focuses "Workspace 3".
Indexes past the last workspace do nothing. The master and column chords apply to the
master/stack and scrolling layouts.

Rift has one master side for all master/stack workspaces, so `;lml` and `;lmr` move the
master area in every workspace already using that layout, then switch the current one to
it. The side isn't saved: it returns to `master_side` from Rift's config file when Rift
restarts or `;,r` reloads the config.

When windows end up out of place, such as a master/stack workspace with an empty master
area, `;b` redraws the layout. Rift forgets the frames it cached for the workspace and
places every window again; in master/stack it first repairs the master/stack split and
moves a stack window into an empty master area. In bsp and traditional layouts it also
evens out split sizes. Re-sending the current mode with `set-layout` does nothing, and
switching to another mode and back would make the last stack window the master. `;b`
can't bring back a window that Rift has stopped tracking.

A minimized or hidden window keeps its place in Rift's layout but gets no space. When the
master window is hidden, the whole master area collapses and the stack fills the screen
in rows, and `;b` leaves it that way because the master area isn't empty. Apps that hide
their window instead of closing it, such as Wispr Flow, cause this when Rift had put that
window in the master area. Focus the window you want as master and press `;p`, or press
`;lms` to swap the hidden window with the first stack window.

Chord bindings live in [`chords/macos.toml`](./chords/macos.toml).

## Development

`vp run test` checks the bindings and the `;m` handler (`src/js/rift.ts`, built to
`js/rift.js` by `vp pack`) and, when `rift-cli` is installed, runs every command through
`sh -c` (as Chord does) with `RIFT_BS_NAME` set to an unregistered Mach service.
`rift-cli` then parses and maps the command but can't reach the running Rift, so a typo or
an invalid argument fails the test without touching any window.

`vp run test:live` (`CHORD_RIFT_LIVE_TEST=1`) drives the Rift running on this Mac. It needs
two adjacent empty workspaces on the current display, and takes over the screen for several
seconds, so leave the Mac alone while it runs. It opens three windows of a fixture app on one of them, runs every chord kind
except `;v` and the display chords, and checks each result through `rift-cli query`. Each
window command runs only while Rift's focused window is a fixture window. Cleanup quits the
fixture, restores both workspaces' layout modes, and returns to the original workspace and
window. With `mouse_follows_focus` on, the pointer moves with focus.
