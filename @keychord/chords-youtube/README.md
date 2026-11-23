# YouTube chords

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

YouTube controls playback and search in a focused browser page. To install, in [Chord](https://github.com/KeyChord/Chord) open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, and select `@keychord/chords-youtube`. Follow the setup below for your platform.

| macOS chord | Linux and Windows chord | Action                                                                                  |
| ----------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `vs30`      | `/yvs30`                | Seek to second 30 (any non-negative integer; clamped to the last playable whole second) |
| `vp`        | `/yvp`                  | Play; repeated calls keep playing                                                       |
| `vh`        | `/yvh`                  | Pause; repeated calls keep paused                                                       |
| `vm`        | `/yvm`                  | Toggle mute                                                                             |
| `va`        | `/yva`                  | Toggle autoplay                                                                         |
| `vc`        | `/yvc`                  | Toggle closed captions                                                                  |
| `v,`        | `/yv,`                  | Toggle the player settings menu                                                         |
| `vt`        | `/yvt`                  | Toggle theater mode                                                                     |
| `vf`        | `/yvf`                  | Toggle video fullscreen                                                                 |
| `js`        | `/yjs`                  | Focus Search and select the current query                                               |

## Linux (X11) and Windows

Use a Chromium browser such as Chrome, Chromium, or Brave with Chord 0.3.4 or later. Launch the browser with the same flags used by [Web Chords](https://github.com/KeyChord/chords-web#linux-x11-and-windows).

```text
--remote-debugging-port=9222 --user-data-dir=<separate-profile-directory>
```

Keep the endpoint on its default loopback address. Chrome 136 and later require a non-default profile for the debugging flags. [Chrome developer documentation](https://developer.chrome.com/blog/remote-debugging-port)

Open YouTube in a browser tab or installed web app in that profile, then focus the webpage. Chord checks document focus again before sending the player action. Change the default `/y` prefix from Settings → Chords → Placeholders.

## macOS

These chords apply while the Brave-installed YouTube web app is focused. Brave's installed web apps do not expose the browser's JavaScript Apple Events API. This package uses the Chrome DevTools Protocol on a local debugging port instead. Quit Brave, then launch it with:

```sh
open -na 'Brave Browser' --args --remote-debugging-port=9222 --restore-last-session
```

Then open the installed YouTube app normally. The handler discovers YouTube pages on that port and selects the focused page when several are open. It reports a setup error if debugging is unavailable and does not restart the browser automatically. Local debugging gives programs on your Mac access to browser pages; enable it only for a browser session you intend to automate.

Video commands require an open video. Controls unavailable on that video report an error. Search also works on the home page.

## Custom port

Set the handler arguments in the TOML file and launch the browser with the same port. On Linux and Windows, keep the second argument set to `true` to require document focus.

```toml
[on.youtube]
file = 'youtube.js'
args = [9333, true]
```

On macOS, set `args = [9333]`.

## Development

From this package directory:

```sh
vp pack
vp fmt .
vp check .
vp exec tsc --noEmit --project tsconfig.json
vp run test
```

`vp run test` runs `bun test --isolate`. The tests exercise the serialized browser payload, all TOML bindings, target selection, protocol errors, socket cleanup, and timeouts.
