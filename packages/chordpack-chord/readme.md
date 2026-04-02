# @keychord/chordpack-chord

Chord's default "out-of-the-box" chordpack.

> Technically, it's not truly "out-of-the-box" because we use this repo as a source of truth for the latest chord packages (instead of having to release a new version of Chord every time these chords are updated).

We use a chordpack instead of a chord package because we don't want to manually delegate all the app-scoped chords defined in `@keychord/chords-com.apple`.

> The API for defining a Chord Pack is likely subject to change. Right now, it's just a single `chordpack.toml` file.
