# @keychord/chords-tray

Chord package for the macOS tray.

`src/ffi/tray/tray.swift` scans menu-bar extras through the Accessibility API and activates them with
AXPress or a Core Graphics mouse event. `src/js/tray.ts` is a thin `bun:ffi` binding over the
compiled native library, so tray actions run in Chord's Bun process without an `osascript` hop.
