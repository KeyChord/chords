# @keychord/chordpack-chord

Chord's default "out-of-the-box" chordpack.

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

There's nothing to install: Chord adds its default chordpack on first launch, and the
packages appear under Settings → Chords → **Chord Repos**. Chord doesn't read this
repo at runtime, though. It bundles its own copy,
[`apps/chord-tauri/data/chordpack.toml`](https://github.com/KeyChord/Chord/blob/dev/apps/chord-tauri/data/chordpack.toml),
and downloads the pinned revision of each listed package from GitHub, so changing
the defaults takes a new Chord release. The revisions in this repo's
[`chordpack.toml`](./chordpack.toml) can differ from the ones Chord ships.

We use a chordpack instead of a chord package because we don't want to manually delegate all the app-scoped chords defined in `@keychord/chords-com.apple`.

> The API for defining a Chord Pack is likely subject to change. Right now, it's just a single `chordpack.toml` file.
