# @keychord/chords-tray

Chord package for the macOS tray.

`Sources/KeychordChordsTrayNativeTray/tray.swift` scans menu-bar extras through the Accessibility API and activates them
with AXPress or a Core Graphics mouse event. NodeSwift exposes the operation as a Node-API function;
`src/js/tray.ts` loads the compiled `tray.node` add-on with `process.dlopen`, so tray actions run in
Chord's Bun process without an `osascript` hop.

`@input:tray` starts with an action type:

```toml
'@input:tray' = ['ITEM', 0]                  # First item; negative indexes count from the right
'@input:tray' = ['ITEM', -1, 'right']        # Last item, right click
'@input:tray' = ['CONTROL_CENTER']
'@input:tray' = ['CONTROL_CENTER', 'DISPLAY', 'INCREASE']
'@input:tray' = ['CONTROL_CENTER', 'SOUND', 'CLICK']
```

`DISPLAY` supports `CLICK`, `DECREASE`, `INCREASE`, `DARK_MODE`, `NIGHT_SHIFT`, `TRUE_TONE`, and `SETTINGS`.
`SOUND` supports `CLICK`, `DECREASE`, and `INCREASE`. Omitting the operation or using `CLICK` expands the
section via its heading/chevron. Adjustments use native slider increment/decrement actions; display
options toggle their accessibility controls. Controls absent on a particular Mac reject with an
unavailable-control error. Display Settings uses `=cds`; `=cd,` expands the section.

`vp pack` builds the Swift addon and JS. `CHORD_SKIP_NATIVE=1 vp pack` builds JS only. `vp run test`
inside this package runs its `bun:test` suites, including building and loading the actual Swift addon.
The root `vp run test:macos` runs live UI checks inside the shared VM from
[`chordtest`](../chordtest/readme.md).
