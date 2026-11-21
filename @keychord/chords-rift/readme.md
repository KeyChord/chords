# @keychord/chords-rift

Global `;r` chords for the [Rift](https://github.com/acsandmann/rift) tiling window
manager. Chords need `rift-cli` on your login shell's `PATH` (Homebrew's
`brew install acsandmann/tap/rift` puts it in `/opt/homebrew/bin`). Window management and
config reload require Rift to be running. The `;rm`, `;rf`, `;rk`, `;rt`, and `;rb` chords run a
handler that queries the current layout first. Rift reports success even for commands that
have no effect, such as a master chord in another layout mode.

Install it from Settings → Browse (**Rift Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-rift`.
AeroSpace's package uses the same keys after its `;a` prefix.

Every chord starts with the same prefix, `;r` by default. To use another key, such as `-`,
set **Window management prefix** under Settings → Chords → Placeholders; the table below
uses `;r`. In [`chords/macos.toml`](./chords/macos.toml) the keys are written `'<>q'`, and
the `[placeholders]` table declares `p` with its default. This needs a Chord with
placeholder support: older versions skip every `<>` chord as an invalid key sequence.

| Chords                                    | `rift-cli execute` command                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `;rw` `;re` `;rn` `;rs`                   | `window focus left` / `right` / `up` / `down`                                                                   |
| `;rm`                                     | `window focus --window-id` with the first visible window in the master area, found with `rift-cli query layout` |
| `;rg]` `;rg[`                             | `window next` / `prev`                                                                                          |
| `;rgf`                                    | `layout toggle-focus-float` (between floating and tiled windows)                                                |
| `;ro` `;ri`                               | `layout ascend` / `descend` (select the parent container / back down)                                           |
| `;rl` `;rr` `;ru` `;rd`                   | `layout move-node left` / `right` / `up` / `down`                                                               |
| `;rp`                                     | `layout promote-to-master` (moves the window into the master area, like `;rlmp`)                                |
| `;rf` `;rk` `;rt` `;rb`                   | `layout swap-windows`: forwards / backwards, or to the top / bottom of the stack (below)                        |
| `;rjl` `;rjr` `;rju` `;rjd` `;rjx`        | `layout join-window left` / `right` / `up` / `down`, `layout unjoin`                                            |
| `;rvf` `;rvs` `;rvo`                      | `window toggle-float`, `layout toggle-stack`, `layout toggle-orientation`                                       |
| `;rzf` `;rzg`                             | `window toggle-fullscreen` / `toggle-fullscreen-within-gaps`                                                    |
| `;rr=` `;rr-`                             | `window resize-grow` / `resize-shrink --orientation smart`                                                      |
| `;rrw=` `;rrw-` `;rrh=` `;rrh-`           | the same with `--orientation horizontal` (width) / `vertical` (height)                                          |
| `;r;`                                     | `layout balance` (also redraws a broken layout)                                                                 |
| `;rlt` `;rlb` `;rls` `;rlm` `;rlc` `;rlf` | `workspace set-layout traditional` / `bsp` / `stack` / `master_stack` / `scrolling` / `floating`                |
| `;rlml` `;rlmr`                           | `config set settings.layout.master_stack.master_side left` / `right`, then `workspace set-layout master_stack`  |
| `;rlmp` `;rlms`                           | `layout promote-to-master` / `swap-master-stack`                                                                |
| `;rlm=` `;rlm-` `;rlmc=` `;rlmc-`         | `layout adjust-master-ratio ±0.05` / `adjust-master-count ±1`                                                   |
| `;rcc` `;rcw]` `;rcw[`                    | `layout center-selection`, `layout switch-preset-column-width [--backwards]`                                    |
| `;rf]` `;rf[` `;rfk`                      | `workspace next` / `prev` / `last` (the previously used workspace)                                              |
| `;rf0`–`;rf9`                             | `workspace switch 0`–`9`                                                                                        |
| `;rm0`–`;rm9` `;rmf0`–`;rmf9`             | `workspace move-window 0`–`9`, with `--follow` for `;rmf`                                                       |
| `;rdw` `;rde` `;rdn` `;rds`               | `display focus --direction left` / `right` / `up` / `down`                                                      |
| `;rdl` `;rdr` `;rdu` `;rdd`               | `display move-window --direction left` / `right` / `up` / `down`                                                |
| `;rtl` `;rtr` `;rtu` `;rtd`               | `display move-workspace --direction left` / `right` / `up` / `down`                                             |
| `;rq`                                     | `window close` (Rift sends Command-W to the focused window's app)                                               |
| `;rv`                                     | `space toggle-activated` (whether Rift manages the current macOS Space)                                         |
| `;r,r`                                    | `config reload`                                                                                                 |

In the **Rift Config** menu, `;r,p` starts Rift's per-user launchd service with
`rift-cli service start`, and `;r,h` stops it with `rift-cli service stop`.

Workspace digits are Rift's 0-based workspace indexes, the numbers its `rift-cli` and
`switch_to_workspace = N` key bindings use: `;rf0` focuses the first workspace. Rift's
menu bar and default workspace names count from 1, so `;rf2` focuses "Workspace 3".
Indexes past the last workspace do nothing. The master and column chords apply to the
master/stack and scrolling layouts.

Master/stack keeps its windows in one order: the master area, then the stack, whichever side
the master area is on. `;rf` moves the focused window forwards, one place closer to the
master area, by swapping it with the window before it; from the top of the stack it trades
places with the last master window. `;rk` moves it backwards, away from the master area.
`;rt` and `;rb` move the window to the top or bottom of the stack, or of the master area when
it's there, and keep the other windows in order; they never cross between the two areas.
`;rp` moves the window straight into the master area. Hidden windows are skipped, and these
chords do nothing when there's nowhere to go or in other layouts. `;rt` and `;rb` swap the
window past each window in the way, so Rift may animate each step.

Rift has one master side for all master/stack workspaces, so `;rlml` and `;rlmr` move the
master area in every workspace already using that layout, then switch the current one to
it. The side isn't saved: it returns to `master_side` from Rift's config file when Rift
restarts or `;r,r` reloads the config.

When windows end up out of place, such as a master/stack workspace with an empty master
area, `;r;` redraws the layout. Rift forgets the frames it cached for the workspace and
places every window again; in master/stack it first repairs the master/stack split and
moves a stack window into an empty master area. In bsp and traditional layouts it also
evens out split sizes. Re-sending the current mode with `set-layout` does nothing, and
switching to another mode and back would make the last stack window the master. `;r;`
can't bring back a window that Rift has stopped tracking.

A minimized or hidden window keeps its place in Rift's layout but gets no space. When the
master window is hidden, the whole master area collapses and the stack fills the screen
in rows, and `;r;` leaves it that way because the master area isn't empty. Apps that hide
their window instead of closing it, such as Wispr Flow, cause this when Rift had put that
window in the master area. Focus the window you want as master and press `;rp`, or press
`;rlms` to swap the hidden window with the first stack window.

Chord bindings live in [`chords/macos.toml`](./chords/macos.toml).

## Development

`vp run test` checks the bindings and the handler for `;rm` and the master/stack moves (`src/js/rift.ts`, built to
`js/rift.js` by `vp pack`). When `rift-cli` is installed, the tests run window management and
config commands with `RIFT_BS_NAME` set to an unregistered Mach service. They validate Play
and Halt with `--help` so the launchd service stays in its current state.

`vp run test:live` (`CHORD_RIFT_LIVE_TEST=1`) drives the Rift running on this Mac. It needs
two adjacent empty workspaces on the current display, and takes over the screen for several
seconds, so leave the Mac alone while it runs. It opens three windows of a fixture app on one of them, runs every chord kind
except `;rv`, the display chords, and the service controls, and checks each result through `rift-cli query`. Each
window command runs only while Rift's focused window is a fixture window. Cleanup quits the
fixture, restores both workspaces' layout modes, and returns to the original workspace and
window. With `mouse_follows_focus` on, the pointer moves with focus.
