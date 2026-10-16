# @keychord/chords-raycast

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chords for [Raycast](https://www.raycast.com/), which must be installed. To install this
package, in [Chord](https://github.com/KeyChord/Chord) open Settings → Chords →
**Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, then tick
`@keychord/chords-raycast` under **Packages to use**.

Use `//<query>` to activate Raycast's first result. For example, `//calculator`
searches for `calculator` and opens its first match. Complete the chord using
Chord's usual completion key. `//` alone opens Raycast.

While Raycast is focused, these chords press its keyboard shortcuts:

| Chord       | Result                                              |
| ----------- | --------------------------------------------------- |
| `nn` / `ns` | Navigate north / south (Up / Down)                  |
| `nw` / `ne` | Navigate west / east (Left / Right)                 |
| `p[` / `p]` | Previous / next page (Option-Up / Option-Down)      |
| `s[` / `s]` | Previous / next section (Command-Up / Command-Down) |

## Direct command launches

Raycast's supported external launch interface is a command deeplink:
`raycast://extensions/<owner>/<extension>/<command>`. Its extension SDK also
provides `launchCommand`, but neither interface resolves an arbitrary Root Search
query to its ranked first match. The Raycast CLI builds and develops extensions;
it is not a Root Search launcher. The installed app has no AppleScript dictionary.

An explicit command deeplink is opened directly. You can also configure exact
query-to-deeplink mappings as the handler's second argument:

```toml
[on.raycast]
file = "raycast.js"
args = [5000, { clips = "raycast://extensions/raycast/clipboard-history/clipboard-history" }]
```

`//clips` then uses Raycast's URL handler without opening Root Search or loading
our Accessibility addon. Copy a command's canonical URL using Raycast's Copy
Deeplink action. Arguments, context, fallback text and launch type in the URL are
preserved. Raycast may show its own launch-confirmation prompt. URL delivery
confirms dispatch, not completion of the target command; failures never trigger
an automatic UI retry that could execute a command twice.

References: [Deeplinks](https://developers.raycast.com/information/lifecycle/deeplinks),
[launchCommand](https://developers.raycast.com/api-reference/command), and
[CLI](https://developers.raycast.com/information/developer-tools/cli).

## Arbitrary queries

When there is no explicit direct route, the handler uses macOS Accessibility:

1. Return from an open command view through its Back control, and wait for
   Raycast's main search input to own focus.
2. Reset a previously identical query's selection, then assign the full query
   through `AXValue` in a single edit.
3. Observe the exact text, changed results, loading state and an enabled primary
   action. Require consecutive matching result snapshots.
4. Re-read focus, query and the result/action fingerprint immediately before
   invoking the primary action with `AXPress`.
5. Confirm that Root Search closes or Raycast navigates to the command's view.

This avoids synthetic Select All/text/Return keystrokes and leaves the clipboard
intact. There is no fixed delay after typing. A stale result restarts observation;
an action that might already have run is never pressed twice. If activation
cannot be confirmed, the Promise rejects instead of silently reporting success.

Chord needs Accessibility access for this fallback. The main-input check currently
recognizes the English `Search for apps and commands…` and `Search for apps or
commands…` labels. Result and action discovery uses accessibility labels, so an
incompatible Raycast UI fails with a readiness error. The timeout covers opening,
search readiness and activation confirmation; it defaults to five seconds and is
the handler's first argument. Duplicate concurrent queries share an action and
different queries run in order.

Build JavaScript and the Swift addon with `vp pack`. Run unit tests with `vp run test`
(`bun test --isolate`) in this directory. Run the production search flow against a
controlled WebKit fixture with `vp run test:macos -- @keychord/chords-raycast` from the
monorepo root; the fixture deliberately delays results beyond 200 ms and verifies exact
Unicode queries and one activation per query.
