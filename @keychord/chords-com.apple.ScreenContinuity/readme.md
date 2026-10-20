# @keychord/chords-com.apple.ScreenContinuity

Chords for iPhone Mirroring (`com.apple.ScreenContinuity`). Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[App bindings](./chords/com/apple/ScreenContinuity/macos.toml).

Build with `vp pack`. Run `vp run test` for Bun tests or
`vp run test:macos -- @keychord/chords-com.apple.ScreenContinuity` from the monorepo root for VM tests.

## Taps and hover

For general clicks in the focused app, use `.` with
[`@keychord/chords-click`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-click).
Mirroring uses `t` to tap and `h` to hover, followed by x/y coordinate pairs. Each
axis has 36 positions in the order `0123456789abcdefghijklmnopqrstuvwxyz`: `0` is
0%, `z` is 100%, and each step is 1/35 of the screen. `t00` taps the top-left; `tzz`
taps the bottom-right. `tii` taps about 51.4% across and down; `t00zz` taps both
opposite corners. Unlike the decimal `.` mouse command, `-` is not a coordinate
here; use `0` for 0%.

Coordinates span the full mirrored device screen, excluding the Mac toolbar and
bezel. Tap targets are clamped two logical points inside the screen edges;
interior coordinates retain their full-screen positions. Rounded corners are not adjusted.
Geometry uses Mirroring's fixed chrome in logical Mac points: 38 at the top
(toolbar plus margin) and 8 on the other edges. It does not depend on the
toolbar's hover-only Accessibility elements or cached measurements. These insets
match the current macOS Mirroring layout; an OS layout change requires updating them.

Use `h` with the same pairs to move without pressing: `h00zz` hovers at the two
opposite corners. Hover uses raw device coordinates: `hzz` reaches the exact 100%
boundary, with no inset or clipping adjustment. Hover releases any previously held drag first and rejects click,
long-press and hold modifiers. Tap and hover sequences share a queue.

For exact pixel offsets, prefix the amount and direction with `=`: `=20l`, `=20r`,
`=20t`, and `=20b` mean 20 logical Mac points from the left, right, top and bottom.
`t=20li` taps 20 points from the left at y=`i`; `h=20b=30r` hovers 30 points from
the right and 20 above the bottom. Directions may appear in either axis order,
and offsets support decimals. Bare `l/r/t/b` are ordinary base-36 coordinates.

`/` followed by one base-36 character refines a coordinate by that many 36ths of
one step. `h/i` means exactly 50%: `(17 + 18/36) / 35`. Thus `th/ih/i` taps the
exact center. Pairs and offsets run together without separators.

Prefix a pair with `,` for a long press: `t00,zzii` taps the top-left, holds the
bottom-right, then taps near the center. The hold lasts 500 ms, matching UIKit's
[default long-press duration](https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer/minimumpressduration).
`.` explicitly selects a normal tap.

Use `t-00zz` to press at the top-left, drag to the bottom-right, then release.
`t-00zz-` keeps the button held after the sequence; `tii-` holds near the center.
`t.=ii` moves without pressing, or continues an already held drag and releases it.
A trailing `-` on that movement keeps it held again.
Within a sequence, `.-` starts a drag and `.=` moves without a new press.
The shared runner releases held buttons on errors, including disconnection.
Global display input (`./`) belongs to the general mouse command, while taps
continue to target the mirrored phone's screen.

The complete sequence is validated before clicking. The shared click runner waits
500 ms between coordinate pairs, keeping drags held during the pause and allowing time for
transitions. Single taps and the final action add no delay. This fixed pause
cannot detect animation completion; see the [click timing rationale](https://github.com/KeyChord/chords/tree/main/@keychord/chords-click#behavior).
iPhone Mirroring must already be connected, and Chord needs Accessibility permission. The
handler moves the Mac pointer to each tap for visibility, then clicks the phone window directly
in the background without changing the foreground app or clicking through the pointer.
It stops if Mirroring disconnects or its window moves, resizes, disappears,
or is replaced. Other windows may cover Mirroring without blocking the targeted clicks.

## Development

`src/js/screen-continuity.ts` uses the NodeSwift add-on built from
`src/swift/screen-continuity/` for geometry and connection checks, then sends input
through `@keychord/chords-click`, which uses the built-in `chord` module's `click`
helper. That helper stamps the actual window ID and private `CGEventSetWindowLocation`
coordinates, then posts to the target process. It reports an error if the private API
is unavailable. Geometry callbacks capture their originating Node-API queue and
complete their promises through that queue, avoiding NodeSwift's async actor fallback
across multiple addons. The read-only regression runs 500 successful and rejected
main-actor completions:
`CHORD_NATIVE_TEST_HOST=<Chord executable> bun test @keychord/chords-com.apple.ScreenContinuity/__tests__/actor-queue.vm.test.ts`.
