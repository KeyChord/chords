# @keychord/chords-chromium

Chord package for chromium-based browsers. Currently supports:

- [Google Chrome](./chords/com/google/Chrome/macos.toml)
- [Google Chrome Beta](./chords/com/google/Chrome/beta/macos.toml)
- [Google Chrome Canary](./chords/com/google/Chrome/canary/macos.toml)
- [Brave](./chords/com/brave/Browser/macos.toml) (unoptimized)
- [Microsoft Edge](./chords/com/microsoft/edgemac/macos.toml) (unoptimized)
- [Opera](./chords/com/operasoftware/Opera/macos.toml) (unoptimized)
- [Vivaldi](./chords/com/vivaldi/Vivaldi/macos.toml) (unoptimized)

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

The chords are active while one of these browsers is focused and send the
browser's own keyboard shortcuts (tabs `t`, windows `w`, history `h`, pages `p`,
bookmarks `b`, zoom `z`, loading `l`, and more). The unoptimized browsers use the
shared [`base.toml`](./chords/base.toml) table.

Install it from Settings → Browse (**Chromium Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-chromium`.
