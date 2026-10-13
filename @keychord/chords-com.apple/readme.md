# @keychord/chords-com.apple

Chord package for pre-installed macOS apps.

## Apps

- [Finder](./chords/com/apple/finder/macos.toml) (`com.apple.finder`)
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

## iPhone Mirroring clicks

For general clicks in the focused app, use `.` with
[`@keychord/chords-click`](../chords-click/readme.md). The Mirroring-specific `t`
handler imports the coordinate parser from `@keychord/chords-click/sequence`, shares
the click routine, and adds connection checks.

Use `t` followed by x/y pairs from the top left. Each bare digit is a coordinate
in tenths: `t13` taps 10% across and 30% down, and `t1313` taps that position twice.
`-` means 0%, `1`–`9` mean 10%–90%, and `0` means 100%.

Add `/` and one digit for mixed fractions: `1/2` means 12%, `9/5` means 95%,
and `-/2` means 2%. `t91/2` taps (90%, 12%). Each `/` consumes exactly one digit
as part of the preceding coordinate, so `t91/21/23/4` taps (90%, 12%), then
(12%, 34%) without separators. `/0` adds zero to the coordinate.

Direction suffixes mark exact pixels: `20l`, `20r`, `20t`, and `20b` mean
20 pixels from the left, right, top, and bottom respectively. `t20l5` taps
x=20 pixels, y=50%; `t20b5` taps halfway across and 20 pixels above the bottom.
Explicit directions can appear in either axis order. Exact values support decimals
and use macOS logical points, independent of Retina scale. Pairs run together;
pixel offsets consume the complete number before their direction suffix. Refine
a shorthand coordinate with `/0` before a pixel amount to keep the numbers
distinct: `t13/020l5` taps (10%, 30%), then (20px, 50%). `/` is exclusively a
fractional suffix.
Coordinates use the current mirroring window's position and size.

Prefix a pair with `,` for a long press: `t13,9228` taps (10%, 30%), holds
(90%, 20%), then normally taps (20%, 80%). The hold lasts 500 ms, matching UIKit's
[default long-press duration](https://developer.apple.com/documentation/uikit/uilongpressgesturerecognizer/minimumpressduration).
`.` explicitly selects a normal tap.

Use `t-1328` to press at (10%, 30%), drag to (20%, 80%), then release.
`t-1328-` keeps the button held after the sequence; `t13-` holds at a single
position. `t=55` moves to the center without pressing, or continues an already
held drag and releases it. A trailing `-` on that movement keeps it held again.
Within a sequence, `.-` starts a drag and `.=` moves without a new press.
The shared runner releases held buttons on errors, including disconnection.
An initial `-` now selects drag; use `0l` to start a normal tap at the left edge.
Global display input (`./`) belongs to the general mouse command, while taps
continue to target the mirrored phone's screen.

The five-tap example is `t20b5-53/07/00r20b65`: center/20 pixels above the bottom,
left edge/halfway down, 30% across/70% down, right edge/20 pixels above the bottom,
then 60% across/halfway down.

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
