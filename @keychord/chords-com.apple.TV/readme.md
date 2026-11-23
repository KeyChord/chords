# @keychord/chords-com.apple.TV

> [!WARNING]
> **EXPERIMENTAL**
>
> This package was largely created with AI and will be reviewed by a human later.

Chords for TV (`com.apple.TV`). Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[macOS app bindings](./chords/com/apple/TV/macos.toml)

[Windows app bindings](./chords/com/apple/TV/windows.toml) cover playback, volume,
playlists, library navigation, imports, and settings in the Microsoft Store app
(`AppleTV.exe`). Navigation uses Apple’s English access keys, which can vary with
language and keyboard layout. Copy and delete require a selected playlist. The
Windows playback chord toggles play/pause. macOS menu actions such as Smart Playlist
and Show in Finder remain platform-specific. Apple provides the TV app for macOS
and Windows. [Apple TV keyboard shortcuts for Windows](https://support.apple.com/guide/tvapp-windows/atvc572afcf3/windows)

Build with `vp pack`. Run `vp run test` for Bun tests or
`vp run test:macos -- @keychord/chords-com.apple.TV` from the monorepo root for VM tests.
