# @keychord/chords-com.apple

Chord package for pre-installed macOS apps.

## Apps

- [Finder](./chords/com/apple/finder/macos.toml) (`com.apple.finder`)
- [Safari](./chords/com/apple/safari/macos.toml) (`com.apple.safari`)
- [Terminal](./chords/com/apple/Terminal/macos.toml) (`com.apple.Terminal`)
- [Activity Monitor](./chords/com/apple/ActivityMonitor/macos.toml) (`com.apple.ActivityMonitor`)
- [iPhone Mirroring](./chords/com/apple/ScreenContinuity/macos.toml) (`com.apple.ScreenContinuity`)

## iPhone Mirroring clicks

Use `j,` followed by one or more coordinate pairs to click the mirrored iPhone screen in order.
Each pair needs a vertical edge (`t` top or `b` bottom) and a horizontal edge (`l` left or `r`
right), in either order. A number starting with a digit is a pixel offset from that edge;
`.5` means half the screen's height or width. Coordinates use the current mirroring window,
including its position and size, rather than the Mac display. Pixel offsets are macOS logical screen pixels (points),
so they are independent of the display's Retina scale.

For example, `j,b20l.5b.5l0b.3l.3b20r0b.5r.4` clicks 20 pixels above the bottom at the horizontal
center, halfway up at the left edge, 30% up and 30% from the left, 20 pixels above the bottom
at the right edge, and halfway up and 40% from the right. Spaces may be included for readability.
Zero offsets on the right or bottom land on the last pixel inside the screen.

The complete sequence is validated before clicking, and clicks are separated by 200 ms.
iPhone Mirroring must already be connected, and Chord needs Accessibility permission. The
handler clicks the phone window in the background without moving the Mac pointer or changing
the foreground app. It stops if Mirroring disconnects or its window moves, resizes, disappears,
or is replaced. Other windows may cover Mirroring without blocking the targeted clicks.
`src/js/screen-continuity.ts` uses the NodeSwift addon for geometry and connection checks,
then calls the shared Rust `click` helper from the built-in `chord` module for input.
The helper stamps the actual window ID and private `CGEventSetWindowLocation` coordinates,
then posts to the target process. It reports an error if the private API is unavailable.

## Safari handler

`src/js/safari.ts` uses Bun's process API for Safari defaults and lifecycle commands, then loads the
NodeSwift add-on built from `Sources/KeychordChordsComAppleNativeSafari/safari.swift` with `process.dlopen`. The add-on sends
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

### `\d+/`

Typing a number `n` followed by a `/` will right click the `n`th tray item. Typing `0` will right click the Notch area.

### `-\d+`

Typing a negative number `n` will left click the `n`th item from the end of the tray. For example, `-1` will always click the last tray item.

### `-\d+/`

Typing a negative number `n` followed by a `/` will right click the `n`th item from the end of the tray.

### `b/?`

Clicks the battery tray item. `/` for right click.

### `w/?`

Clicks the Wi-Fi tray item. `/` for right click.

### `c/?`

Clicks the Control Center tray item. `/` for right click.

### `t/?`

Clicks the Time & Date tray item. `/` for right click.
