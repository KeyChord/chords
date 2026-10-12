# YouTube chords

Commands for the installed Brave YouTube app (`com.brave.Browser.app.agimnkijcaahngcdmfeangaknmldooml`).

| Chord  | Action                                                                                  |
| ------ | --------------------------------------------------------------------------------------- |
| `vs30` | Seek to second 30 (any non-negative integer; clamped to the last playable whole second) |
| `vp`   | Play; repeated calls keep playing                                                       |
| `vh`   | Pause; repeated calls keep paused                                                       |
| `vm`   | Toggle mute                                                                             |
| `va`   | Toggle autoplay                                                                         |
| `vc`   | Toggle closed captions                                                                  |
| `v,`   | Toggle the player settings menu                                                         |
| `vt`   | Toggle theater mode                                                                     |
| `vf`   | Toggle video fullscreen                                                                 |
| `js`   | Focus Search and select the current query                                               |

## Browser setup

Brave's installed web apps do not expose the browser's JavaScript Apple Events API. This package uses the Chrome DevTools Protocol on a local debugging port instead. Quit Brave, then launch it with:

```sh
open -na 'Brave Browser' --args --remote-debugging-port=9222 --restore-last-session
```

Then open the installed YouTube app normally. The handler discovers YouTube pages on that port and selects the focused page when several are open. It reports a setup error if debugging is unavailable and does not restart the browser automatically. Local debugging gives programs on your Mac access to browser pages; enable it only for a browser session you intend to automate.

For another port, set the handler arguments in the TOML file and launch Brave with the same port:

```toml
[on.youtube]
file = 'youtube.js'
args = [9333]
```

Video commands require an open video. Controls unavailable on that video report an error. Search also works on the home page.

## Development

From this package directory:

```sh
vp pack
vp fmt .
vp check .
vp exec tsc --noEmit --project tsconfig.json
vp test
```

The tests exercise the serialized browser payload, all TOML bindings, target selection, protocol errors, socket cleanup, and timeouts. Live verification on 2026-10-11 used the compiled handler in Chord's embedded Bun runtime against the installed YouTube app: repeated play/pause, an exact seek to 30 seconds, toggles in both directions, settings visibility, fullscreen entry/exit, and Search focus.
