# @keychord/chords-com.apple.Music

> [!WARNING]
> **EXPERIMENTAL**
>
> This package was largely created with AI and will be reviewed by a human later.

Chords for Apple Music. Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

- [macOS bindings](./chords/com/apple/Music/macos.toml) use Music's menus and shortcuts.
- [Windows bindings](./chords/com/apple/Music/windows.toml) use the native shortcuts of the
  [Apple Music app from the Microsoft Store](https://apps.microsoft.com/detail/9pfhdd62mxs1).
  Library navigation and some playback controls use the English access keys shown by Alt.

On Linux, Apple Music is available through its web player. This package binds the native apps.

[Apple Music keyboard shortcuts for Windows](https://support.apple.com/guide/music-windows/keyboard-shortcuts-mus1019/windows).

Build with `vp pack`. Run `vp run test` for Bun tests or
`vp run test:macos -- @keychord/chords-com.apple.Music` from the monorepo root for VM tests.
