# @keychord/chords-web

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Web Chords scrolls the active Chromium browser tab in four directions. Install
`@keychord/chords-web` in Chord from Settings → Chords → **Chord Monorepos** →
**Add Monorepo**, enter `KeyChord/chords`, and select the package.

## Linux (X11) and Windows

Web Chords uses Chrome DevTools Protocol with Chrome, Chromium, Brave, Edge, Opera,
or Vivaldi. Launch the browser with both of these flags:

```text
--remote-debugging-port=9222 --user-data-dir=<separate-profile-directory>
```

Use a dedicated profile and keep the debugging endpoint on its default loopback
address. Chrome 136 and later require a non-default profile for the debugging
flags. Focus the webpage itself before using a chord. Web Chords only sends scroll
commands to a tab with document focus, so it leaves background tabs alone.

| Chord | Result                  |
| ----- | ----------------------- |
| `/bn` | Scroll up 100 pixels    |
| `/bs` | Scroll down 100 pixels  |
| `/be` | Scroll right 100 pixels |
| `/bw` | Scroll left 100 pixels  |

`/b` comes from the default global symbol and the package's `b` placeholder. Change
it from Settings → Chords → Placeholders. Linux and Windows require Chord 0.3.4 or later.

## macOS

The macOS chords in [`chords/macos.toml`](./chords/macos.toml) are disabled. The legacy
handler sends JavaScript to the active Chrome, Brave, Edge, or Arc tab using Apple
events. Chord requires Automation permission for the browser, and the browser must
allow JavaScript from Apple Events.

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
Building the macOS addon requires Swift 6.1 or later. The addon supports macOS 13 or later.
Run `CHORD_SKIP_NATIVE=1 vp pack` to rebuild the portable handler and manifests using
existing packaged macOS artifacts.
