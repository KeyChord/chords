# Spotify chords

Commands for the macOS Spotify desktop app (`com.spotify.client`).

App bindings live in `chords/com/spotify/client/macos.toml`, the path Chord uses to discover Spotify's chords.

| Chord   | Action                                                   |
| ------- | -------------------------------------------------------- |
| `gls`   | Go to Liked Songs                                        |
| `p5m`   | Open track #5's More menu                                |
| `p5r`   | Remove track #5 from the current playlist or Liked Songs |
| `p5a`   | Add track #5 to the queue                                |
| `p5e`   | Exclude track #5 from your taste profile                 |
| `p5sj`  | Start a Jam with track #5                                |
| `p5gsr` | Go to track #5's song radio                              |
| `p5gar` | Go to track #5's artist                                  |
| `p5gal` | Go to track #5's album                                   |
| `p5vc`  | View track #5's credits                                  |
| `p5sc`  | Share: copy track #5's song link                         |
| `p5se`  | Share: open track #5's embed dialog                      |

Replace `5` with any positive playlist track number. Numbers follow the displayed playlist order, including sorting and filtering. Spotify virtualizes long lists; scroll the requested track into view first. These chords operate on the current playlist, including Liked Songs. Unavailable or disabled menu actions report an error. Menu matching currently requires Spotify's English interface. Exclude and Remove perform those actions, rather than toggling their inverse.

## Setup

Liked Songs uses Spotify's native deep link and needs no debugging port. Playlist actions use the Chrome DevTools Protocol against Spotify's desktop renderer. Quit Spotify, then launch it with:

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

Use `vp pack` from this package directory to build the JavaScript artifacts. From the workspace root, run `vp check` and `vp test`. The Spotify tests execute the serialized page payload against desktop-style playlist and menu fixtures, validate every TOML binding, and cover target selection, overlapping commands, protocol failures, timeouts, and socket cleanup.
