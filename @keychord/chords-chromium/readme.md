# @keychord/chords-chromium

Chord package for Chromium-based browsers.

## macOS

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

## Linux and Windows

Chrome, Chromium, Brave, Edge, Opera, and Vivaldi have app-specific bindings for
their default desktop shortcuts. Chrome and Chromium builds that use the same
executable name share one set of chords, including browser release channels.
The Linux and Windows files use keyboard shortcuts for tabs, windows, page
navigation, zoom, and browser tools. The browser debugging and Google-results
bindings are available in the macOS files.

[Chrome shortcuts](https://support.google.com/chrome/answer/157179),
[Brave shortcuts](https://support.brave.app/hc/en-us/articles/360032272171-What-keyboard-shortcuts-can-I-use-in-Brave),
[Edge shortcuts](https://support.microsoft.com/en-gb/edge/keyboard-shortcuts-in-microsoft-edge),
[Opera shortcuts](https://help.opera.com/en/latest/shortcuts/),
[Vivaldi shortcuts](https://help.vivaldi.com/desktop/shortcuts/keyboard-shortcuts/)

Install it from Settings → Browse (**Chromium Chords**), which adds this package's
mirror repo. For the current version, add the `KeyChord/chords` monorepo under
Settings → Chords → Chord Monorepos instead and tick `@keychord/chords-chromium`.
