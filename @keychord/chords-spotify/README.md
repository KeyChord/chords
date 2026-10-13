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

## Setup

Liked Songs uses Spotify's native deep link and needs no debugging port. Playlist and bar actions use the Chrome DevTools Protocol against Spotify's desktop renderer. Quit Spotify, then launch it with:

```sh
open -na Spotify --args --remote-debugging-port=9223
```

For another port, launch Spotify with that port and configure the same value in the chord file:

```toml
[on.spotify]
file = 'spotify.js'
args = [9333]
```

The handler targets the desktop renderer (`xpui.app.spotify.com`), selecting the focused page when there are several. It reports a setup error when debugging is unavailable and does not restart Spotify automatically. Port 9223 leaves the usual browser debugging port 9222 available.

## Development

Use `vp pack` from this package directory to build the JavaScript artifacts. From the workspace root, run `vp check` and `vp test`. The Spotify tests execute the serialized page payload against desktop-style playlist, menu, and Now Playing fixtures, validate every TOML binding, and cover exact scrubbing, playback states, unavailable controls, target selection, overlapping commands, protocol failures, timeouts, and socket cleanup.
