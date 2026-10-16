# @keychord/chords-com.apple

Chord package for pre-installed macOS apps.

Finder chords are provided by [`@keychord/chords-finder`](../chords-finder/readme.md).

## Apps

- [Safari](./chords/com/apple/safari/macos.toml) (`com.apple.safari`)
- [Terminal](./chords/com/apple/Terminal/macos.toml) (`com.apple.Terminal`)
- [Activity Monitor](./chords/com/apple/ActivityMonitor/macos.toml) (`com.apple.ActivityMonitor`)
- [iPhone Mirroring](./chords/com/apple/ScreenContinuity/macos.toml) (`com.apple.ScreenContinuity`)
- [System Preferences](./chords/com/apple/systempreferences/macos.toml) (`com.apple.systempreferences`)

## System Preferences

`/,` opens System Settings. The `g` chords open their named settings panes directly
using macOS's `x-apple.systempreferences` URLs, including the iCloud scene. Some
panes require compatible hardware or an Apple Account.

`apa`, `apd`, and `apl` apply Auto, Dark, and Light system appearance respectively.
The Bun handler calls SkyLight in-process and disables automatic switching when
selecting Light or Dark. These private macOS APIs are resolved before applying a
change; an unavailable API reports an error.

## iPhone Mirroring taps and hover

For general clicks in the focused app, use `.` with
[`@keychord/chords-click`](../chords-click/readme.md). Mirroring uses `t` to tap
and `h` to hover, followed by x/y coordinate pairs. Each axis has 36 positions in
the order `0123456789abcdefghijklmnopqrstuvwxyz`: `0` is 0%, `z` is 100%, and
each step is 1/35 of the screen. `t00` taps the top-left; `tzz` taps the bottom-right.
`tii` taps about 51.4% across and down; `t00zz` taps both opposite corners.

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
An initial `-` selects drag. `-` is no longer a zero coordinate; use `0`.
Global display input (`./`) belongs to the general mouse command, while taps
continue to target the mirrored phone's screen.

The old `t=...` movement prefix is now reserved for pixel offsets; use `h...` for
hover or `t.=...` to continue a drag. Decimal `t` sequences and fractional suffixes
now use base 36. The general `.` mouse command retains its existing decimal syntax.

The complete sequence is validated before clicking. The shared click runner waits
500 ms between coordinate pairs, keeping drags held during the pause and allowing time for
transitions. Single taps and the final action add no delay. This fixed pause
cannot detect animation completion; see the [click timing rationale](../chords-click/readme.md).
iPhone Mirroring must already be connected, and Chord needs Accessibility permission. The
handler moves the Mac pointer to each tap for visibility, then clicks the phone window directly
in the background without changing the foreground app or clicking through the pointer.
It stops if Mirroring disconnects or its window moves, resizes, disappears,
or is replaced. Other windows may cover Mirroring without blocking the targeted clicks.
`src/js/screen-continuity.ts` uses the NodeSwift addon for geometry and connection checks,
then calls the shared Rust `click` helper from the built-in `chord` module for input.
The helper stamps the actual window ID and private `CGEventSetWindowLocation` coordinates,
then posts to the target process. It reports an error if the private API is unavailable.
Geometry callbacks capture their originating Node-API queue and complete their promises
through that queue, avoiding NodeSwift's async actor fallback across multiple addons.
The read-only regression runs 500 successful and rejected main-actor completions:
`CHORD_NATIVE_TEST_HOST=<Chord executable> bun test @keychord/chords-com.apple/__tests__/actor-queue.vm.test.ts`.

## Safari handler

`src/js/safari.ts` uses Bun's process API for Safari defaults and lifecycle commands, then loads the
NodeSwift add-on built from `Sources/KeychordChordsComAppleNativeSafari/safari.swift` with `import addon from "./safari.node"`.
The built-in config plugin packages Safari and Screen Continuity addons with their runtime libraries. The Safari add-on sends
Safari's `do JavaScript` Apple event directly and uses the Accessibility API to select the Developer
pane when the JavaScript-from-Apple-events setting still needs to be enabled.

The [swift-scripting-bridge](https://github.com/rhx/swift-scripting-bridge) build plugin generates
the Safari interfaces from `Sources/KeychordChordsComAppleNativeSafari/SafariBrowser.sdef`.
This small, checked-in dictionary keeps builds independent of the installed Safari version.
The plugin is pinned before an upstream manifest change that declares a missing target.
Apple events retain their 60-second timeout, and the Scripting Bridge delegate converts failures
into Swift errors. The generated code uses Apple's system framework without an additional runtime library.

## Menu

The built-in menu navigation chord handler uses the prefix `-` and is dynamic based on what you type afterwards:

### `\d+`

Typing a number `n` will click the `n`th menu in the menu bar of the currently focused application.

### `([a-z])\1`

Typing a sequence of repeating letters will match the `.length`-th menu that starts with that letter. For example, given the following menu bar:

```
File | Edit | View | History | Window | Help
```

Typing `-h` will match History, but typing `-hh` will match Help.

### `[a-z-]+\d+?`

Typing a sequence of non-repeating letters optionally followed by a number `n` will match the `n`th menu _item_ (`1st` if unspecified) that starts with those letters. Only works when a menu is expanded. A `-` may be used to match "spaces" so you can match by abbreviation instead of prefix.

For example, given the following menu items:

```
Zoom in
Zoom out
```

Typing `z` or `zo` will match Zoom In, but typing `z-o` or `z2` will match Zoom Out.

## Tray

The built-in tray chord handler uses the prefix `=` and is dynamic based on what you type afterwards:

### `\d+`

Typing a number `n` will left click the `n`th tray item. Typing `0` will click the Notch area.

### `\d+\.,`

Typing a number `n` followed by `.,` will right click the `n`th tray item. Typing `0` will right click the Notch area.

### `-\d+`

Typing a negative number `n` will left click the `n`th item from the end of the tray. For example, `-1` will always click the last tray item.

### `-\d+\.,`

Typing a negative number `n` followed by `.,` will right click the `n`th item from the end of the tray.

### `b(\.,)?`

Clicks the battery tray item. `.,` for right click.

### `w(\.,)?`

Clicks the Wi-Fi tray item. `.,` for right click.

### `c(\.,)?`

Clicks the Control Center tray item. `.,` for right click.

### `t(\.,)?`

Clicks the Time & Date tray item. `.,` for right click.
