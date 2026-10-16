# @keychord/chords-web

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Global `;` chords that send JavaScript to the active tab of the front window in Google Chrome,
Brave Browser, Microsoft Edge, or Arc. To install, in [Chord](https://github.com/KeyChord/Chord)
open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, then
tick `@keychord/chords-web` under **Packages to use**.

| Chord | Result                  |
| ----- | ----------------------- |
| `;n`  | Scroll up 100 pixels    |
| `;s`  | Scroll down 100 pixels  |
| `;e`  | Scroll right 100 pixels |
| `;w`  | Scroll left 100 pixels  |

Chord needs Automation permission for the browser, and the browser must allow JavaScript from
Apple events (in Chrome: View → Developer → Allow JavaScript from Apple Events). When the
frontmost app is not one of the supported browsers, the chord shows an "Unsupported Browser"
alert instead.

## Development

The native addon uses Apple's Scripting Bridge framework. The
[swift-scripting-bridge](https://github.com/rhx/swift-scripting-bridge) build plugin generates
typed browser interfaces from `Sources/KeychordChordsWebNativeWeb/Chromium.sdef`.
The checked-in dictionary contains only the browser objects used here; builds do not require
an installed browser. The plugin is pinned before an upstream manifest change that declares
a missing target. It runs at build time and adds no runtime library to the addon.

The generator does not model Chromium's JavaScript command on its tab receiver. A small
`JavaScriptTab` protocol supplies the `executeJavascript:` selector emitted by Apple's `sdp`.
Apple events retain their 60-second timeout, and an error delegate reports failures to JavaScript.

Run `vp pack` in this directory to regenerate the bindings, build the addon, and package the handler.
Building requires Swift 6.1 or later; the addon supports macOS 13 or later.
