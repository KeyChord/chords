# @keychord/chords-raycast

Chord package for Raycast.

Includes `//<query>` to search Raycast and activate the first result, consolidated from
[leonsilicon/chords](https://github.com/leonsilicon/chords), along with navigation,
page, and section shortcuts.

For example, `//calculator` opens Raycast, replaces any existing search text with
`calculator`, and presses Return to activate the first result. Complete the chord
using Chord's usual completion key. `//` on its own opens Raycast without selecting
a result. This replaces the previous `/r` shortcut.

The TypeScript input handler waits for Raycast's main search field to own keyboard
focus, then sends Unicode keyboard input directly to Raycast's process without
changing the clipboard. It observes the full search text and allows 200 ms for
the results to update before pressing Return. The native addon rechecks focus and
the query before submitting. Duplicate concurrent queries share one action;
different queries run in order. Launch failures, denied Accessibility access,
focus changes, and readiness timeouts reject the Promise.

The focus check recognizes the English `Search for apps and commands…` and
`Search for apps or commands…` inputs. Chord needs Accessibility access.
The timeout covers launch and search readiness, defaults to five seconds, and can
be set through the handler args:

```toml
[on.raycast]
file = "raycast.js"
args = [10000]
```

Build with `vp pack`, including the Swift accessibility addon. Run package tests
from the monorepo root with `vp test @keychord/chords-raycast`.
