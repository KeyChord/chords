# @keychord/chords-betterdisplay

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Set the resolution of the display containing the pointer with
[BetterDisplay](https://betterdisplay.pro/). This package owns `/md`;
[`chords-monitors`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-monitors)
provides monitor focusing.

To install it, add the `KeyChord/chords` monorepo under Settings → Chords → Chord
Monorepos and tick `@keychord/chords-betterdisplay`.

| Chord                 | Result                                                          |
| --------------------- | --------------------------------------------------------------- |
| `/md<width>x<height>` | Set a `<width>` × `<height>` desktop, e.g. `/md1440x1728`       |
| `/md0`                | Remove this package's virtual screens for the pointer's display |

## Requirements

Install and run BetterDisplay with CLI integration enabled (the default). The
handler uses `BETTERDISPLAY_CLI` if it's set, otherwise `betterdisplaycli` from PATH,
otherwise the CLI bundled in `/Applications/BetterDisplay.app` or
`~/Applications/BetterDisplay.app`. Custom-resolution mirroring requires BetterDisplay
Pro or its trial.

## Behavior

Both dimensions must be positive integers, up to 16384. They describe macOS logical
desktop points, not the physical panel's pixels. Existing display modes are selected
directly. For an unavailable size, the handler creates a Retina virtual screen with
that exact desktop size and mirrors it to the physical display. Different aspect
ratios can produce black bars. macOS/GPU limits still apply; a command rejects if
BetterDisplay cannot apply the exact dimensions.

Changes are serialized and checked after application. A failed switch attempts
to restore the preceding native resolution and managed mirror. Switching to a
native mode or using `/md0` removes only virtual screens created by this
package for that display. Other virtual screens are left alone. The reserved
virtual-screen name format is `Chord /md <display UUID> <dimensions> <unique UUID>`.

BetterDisplay owns the resulting configuration: it persists when Chord quits or
reloads. Use `/md0` to return from a custom virtual desktop; it does not undo
a directly selected native mode. The handler also recognizes its mirrored
virtual screen after a Chord restart, so subsequent `/md` commands keep targeting
the same physical display.

The implementation uses BetterDisplay's [CLI API](https://betterdisplay.pro/guide/integration/cli-reference/)
and [custom virtual resolution lists](https://betterdisplay.pro/guide/interface-reference/settings/displays/virtual-screen/).

## Development

Build with `vp pack` in this directory. Test from the monorepo root with
`vp run --filter @keychord/chords-betterdisplay test`.

To run the opt-in live check, use
`CHORD_BETTERDISPLAY_LIVE_TEST=1 bun __tests__/monitor.integration.ts` here. It
temporarily changes the real desktop and restores the initial mode in cleanup.
