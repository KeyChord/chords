# @keychord/chords-betterdisplay

Set the resolution of the display containing the pointer with BetterDisplay.
Enable this package in Chord's monorepo package selection, then reload chords.
This package owns `/ms`; `chords-dock` continues to provide monitor focusing.

| Chord          | Result                                                          |
| -------------- | --------------------------------------------------------------- |
| `/ms1440x1728` | Set a 1440 × 1728 desktop                                       |
| `/ms720x864`   | Set a 720 × 864 desktop                                         |
| `/ms1920x1080` | Set a 1920 × 1080 desktop                                       |
| `/ms0`         | Remove this package's virtual screens for the pointer's display |

Install and run [BetterDisplay](https://betterdisplay.pro/) with CLI integration
enabled (the default). The handler uses `betterdisplaycli` from PATH or the CLI
bundled in `/Applications/BetterDisplay.app` or `~/Applications/BetterDisplay.app`.
Set `BETTERDISPLAY_CLI` to an executable path for another installation location.
Custom-resolution mirroring requires BetterDisplay Pro or its trial.

Both dimensions must be positive absolute integers, up to 16384. They describe
macOS logical desktop points, not the physical panel's pixels. Existing display
modes are selected directly. For an unavailable size, the handler creates a
Retina virtual screen with that exact desktop size and mirrors it to the physical
display. Different aspect ratios can produce black bars. macOS/GPU limits still
apply; a command rejects if BetterDisplay cannot apply the exact dimensions.

Changes are serialized and checked after application. A failed switch attempts
to restore the preceding native resolution and managed mirror. Switching to a
native mode or using `/ms0` removes only virtual screens created by this
package for that display. Other virtual screens are left alone. The reserved
virtual-screen name format is `Chord /ms <display UUID> <size> <unique UUID>`.

BetterDisplay owns the resulting configuration: it persists when Chord quits or
reloads. Use `/ms0` to return from a custom virtual desktop; it does not undo
a directly selected native mode. The handler also recognizes its mirrored
virtual screen after a Chord restart, so subsequent `/ms` commands keep targeting
the same physical display.

Build with `vp pack` in this directory. Test from the monorepo root with
`vp test @keychord/chords-betterdisplay/__tests__/monitor.test.ts`.

To run the opt-in live check, use
`CHORD_BETTERDISPLAY_LIVE_TEST=1 bun __tests__/monitor.integration.ts` here. It
temporarily changes the real desktop and restores the initial mode in cleanup.

The implementation uses BetterDisplay's [CLI API](https://betterdisplay.pro/guide/integration/cli-reference/)
and [custom virtual resolution lists](https://betterdisplay.pro/guide/interface-reference/settings/displays/virtual-screen/).
