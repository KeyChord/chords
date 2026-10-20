# @keychord/chords-com.apple.systempreferences

Chords for System Preferences (`com.apple.systempreferences`). Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[App bindings](./chords/com/apple/systempreferences/macos.toml) and [global bindings](./chords/macos.toml).

Build with `vp pack`. Run `vp run test` for Bun tests or
`vp run test:macos -- @keychord/chords-com.apple.systempreferences` from the monorepo root for VM tests.

The `g` chords open their named settings panes directly using macOS's
`x-apple.systempreferences` URLs, including the iCloud scene. Some panes require
compatible hardware or an Apple Account.

`apa`, `apd`, and `apl` apply Auto, Dark, and Light system appearance respectively.
The Bun handler calls SkyLight in-process and disables automatic switching when
selecting Light or Dark. These private macOS APIs are resolved before applying a
change; an unavailable API reports an error.
