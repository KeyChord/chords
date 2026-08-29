# @keychord/chords-tray

Chord package for the macOS tray.

`src/swift/tray/tray.swift` scans menu-bar extras through the Accessibility API and activates them
with AXPress or a Core Graphics mouse event. NodeSwift exposes the operation as a Node-API function;
`src/js/tray.ts` loads the compiled `tray.node` add-on with `process.dlopen`, so tray actions run in
Chord's Bun process without an `osascript` hop.
