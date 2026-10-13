# @keychord/chords-raycast

Chord package for Raycast.

Includes `/r` to open Raycast, consolidated from
[leonsilicon/chords](https://github.com/leonsilicon/chords), along with navigation,
page, and section shortcuts.

`/r` runs a TypeScript input handler whose Promise resolves after Raycast's main
search field has keyboard focus. It polls Raycast's focused accessibility
element and confirms the app is in the foreground. Concurrent invocations
share one launch. Launch failures, denied Accessibility access, and a focus
timeout reject the Promise.

The focus check recognizes the English `Search for apps and commands…` and
`Search for apps or commands…` inputs. Chord needs Accessibility access.
The timeout defaults to five seconds and can be set through the handler args:

```toml
[on.raycast]
file = "raycast.js"
args = [10000]
```

Build with `vp pack`, including the Swift accessibility addon. Run package tests
from the monorepo root with `vp test @keychord/chords-raycast`.
