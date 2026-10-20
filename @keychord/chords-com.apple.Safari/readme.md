# @keychord/chords-com.apple.Safari

Chords for Safari (`com.apple.Safari`). Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[App bindings](./chords/com/apple/Safari/macos.toml) and [global bindings](./chords/macos.toml).

Build with `vp pack`. Run `vp run test` for Bun tests or
`vp run test:macos -- @keychord/chords-com.apple.Safari` from the monorepo root for VM tests.

## JavaScript

`js` checks that Safari accepts JavaScript from Apple events by running
`document.title;` in the current tab. If Safari's "Allow JavaScript from Apple Events"
setting is off, it instead enables the Develop menu (restarting Safari if needed) and
opens Safari's Developer settings so you can turn the setting on. The handler reads
the setting when chords load, so reload chords (`0,r`) after changing it.

## Development

`src/js/safari.ts` uses Bun's process API for Safari defaults and lifecycle commands, then loads the
NodeSwift add-on built from `Sources/KeychordChordsComAppleNativeSafari/safari.swift` with `import addon from "./safari.node"`.
The built-in config plugin packages the Safari addon with its runtime libraries. The Safari add-on sends
Safari's `do JavaScript` Apple event directly and uses the Accessibility API to select the Developer
pane when the JavaScript-from-Apple-events setting still needs to be enabled.

The [swift-scripting-bridge](https://github.com/rhx/swift-scripting-bridge) build plugin generates
the Safari interfaces from `Sources/KeychordChordsComAppleNativeSafari/SafariBrowser.sdef`.
This small, checked-in dictionary keeps builds independent of the installed Safari version.
The plugin is pinned before an upstream manifest change that declares a missing target.
Apple events retain their 60-second timeout, and the Scripting Bridge delegate converts failures
into Swift errors. The generated code uses Apple's system framework without an additional runtime library.
