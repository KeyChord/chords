# Spotify chords

Commands for the macOS Spotify desktop app (`com.spotify.client`).

App bindings live in `chords/com/spotify/client/macos.toml`, the path Chord uses to discover Spotify's chords.

| Chord   | Action                                                   |
| ------- | -------------------------------------------------------- |
| `gls`   | Go to Liked Songs                                        |
| `pm5`   | Open track #5's More menu                                |
| `pr5`   | Remove track #5 from the current playlist or Liked Songs |
| `pa5`   | Add track #5 to the queue                                |
| `pe5`   | Exclude track #5 from your taste profile                 |
| `psj5`  | Start a Jam with track #5                                |
| `pgsr5` | Go to track #5's song radio                              |
| `pgar5` | Go to track #5's artist                                  |
| `pgal5` | Go to track #5's album                                   |
| `pvc5`  | View track #5's credits                                  |
| `psc5`  | Share: copy track #5's song link                         |
| `pse5`  | Share: open track #5's embed dialog                      |

Replace `5` with any positive playlist track number. Numbers follow the displayed playlist order, including sorting and filtering. Spotify virtualizes long lists; scroll the requested track into view first. These chords operate on the current playlist, including Liked Songs. Unavailable or disabled menu actions report an error. Menu matching currently requires Spotify's English interface. Exclude and Remove perform those actions, rather than toggling their inverse.

## Now Playing bar

| Chord  | Action                                                                          |
| ------ | ------------------------------------------------------------------------------- |
| `b[`   | Previous track / restart the current track, following Spotify's Previous button |
| `b]`   | Next track                                                                      |
| `bp`   | Play; keep playing if already playing                                           |
| `bh`   | Halt (pause); keep paused if already paused                                     |
| `br`   | Cycle Spotify's repeat modes                                                    |
| `bl`   | Toggle lyrics                                                                   |
| `bq`   | Toggle the queue panel                                                          |
| `bc`   | Open / close Connect to a device                                                |
| `bm`   | Open / close the Miniplayer                                                     |
| `bf`   | Enter / exit full screen                                                        |
| `bs`   | Toggle / cycle Spotify's shuffle control                                        |
| `bs37` | Scrub to exactly 37 seconds                                                     |

Replace `37` with any non-negative whole second (`bs0` returns to the start). A time beyond the track's duration seeks to its last playable whole second. Bar commands work wherever Spotify shows its Now Playing bar and report an error when a control is unavailable. Play/Halt and controls without stable test IDs require Spotify's English interface. `?b` and `?bs` are group hints.

## Now Playing view

| Chord | Action                                    |
| ----- | ----------------------------------------- |
| `npv` | Show / hide the Now Playing view          |
| `npx` | Hide the Now Playing view                 |
| `npf` | Expand the Now Playing view               |
| `npm` | Minimize the expanded view to the sidebar |
| `npa` | View artwork                              |
| `npc` | View Canvas                               |
| `npi` | View the artist image                     |
| `npl` | View lyrics                               |

`?np` is the group hint. The four view commands open and expand Now Playing before selecting the requested view. Hide, Expand, Minimize, and view selection keep the requested state when repeated; Minimize leaves a hidden view hidden. Toggle and Hide also hide an expanded view. `npf` uses Spotify's **Expand Now Playing view** control; `bf` controls full screen. These commands require Spotify's English interface and report an error when the current track lacks the requested view.

## Setup

All actions use the Chrome DevTools Protocol against Spotify's desktop renderer. When the package loads or Spotify launches, Chord checks its debugging port. If it does not match the configured port (9223 by default), Chord gracefully terminates Spotify and relaunches it with debugging enabled.

Spotify appears in Chord's apps-needing-relaunch settings until a launch with the correct port is observed. A normal quit stays quit. If a chord runs before Spotify finishes relaunching, try it again once Spotify is open. Port 9223 leaves the usual browser debugging port 9222 available.

For manual setup, quit Spotify, then launch it with:

```sh
open -na Spotify --args --remote-debugging-port=9223
```

For another port, configure the value in the chord file; Chord relaunches Spotify with that port:

```toml
[on.spotify]
file = 'spotify.js'
args = [9333]
```

The handler targets the desktop renderer (`xpui.app.spotify.com`), selecting the focused page when there are several. It reports a setup error when debugging is unavailable. Extra Spotify instances or a custom user-data directory require manual setup.

`gls` navigates through Spotify's router and replaces the destination with fresh view state. This also works when Liked Songs is already the underlying page and another view, such as expanded Lyrics, covers it. It waits for the destination to render before the next chord runs. Router discovery uses React's committed tree and Spotify's navigation API; if an app update removes that API, the command reports an error.

## Development

Use `vp pack` from this package directory to build the JavaScript artifacts. From the workspace root, run `vp check` and `vp test`. The Spotify tests execute the serialized page payload against desktop-style playlist, menu, and Now Playing fixtures, validate every TOML binding, and cover exact scrubbing, playback states, unavailable controls, target selection, overlapping commands, protocol failures, timeouts, and socket cleanup.
