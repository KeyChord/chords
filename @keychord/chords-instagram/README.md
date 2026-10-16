# Instagram chords

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

For the installed Brave Instagram app (`com.brave.Browser.app.akpamiohjfcnimfljfndmaldlcfphjmp`):
instagram.com installed from [Brave](https://brave.com/) as an app. Brave needs remote
debugging, which Chord sets up for you (see [Browser setup](#browser-setup)).

To install the package, add the `KeyChord/chords` monorepo under Settings → Chords →
Chord Monorepos and tick `@keychord/chords-instagram`.

| Chord  | Action                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------ |
| `gh`   | Open Home                                                                                        |
| `gr`   | Open Reels                                                                                       |
| `gm`   | Open Messages                                                                                    |
| `gs`   | Open Search, focus the input, and select the existing query                                      |
| `gc`   | Open the Create post composer                                                                    |
| `gp`   | Open your own profile                                                                            |
| `hs.N` | Click story N in Home's rendered story tray, starting at 1 (`hs.1`, `hs.2`, etc.)                |
| `hsrN` | Open story N from Home and focus its reply field (`hsr1`, `hsr2`, etc.)                          |
| `pa.`  | Click the avatar on the displayed profile; on your own profile this opens the profile-photo menu |
| `pan`  | Open the note editor above your own profile avatar                                               |
| `panx` | Close the note editor                                                                            |

Goto chords close the current story viewer or dismissible dialog using Instagram's Close or Cancel control, then wait for navigation to become available. They also work while a story reply field has focus. Any unsaved-draft confirmation stays open for you to resolve before navigation continues.

Navigation matches the labeled SVG icons and your profile avatar in both the sidebar and the compact bottom bar. Search also recognizes the compact Explore icon, then focuses and selects the search query.

Notes requires your own profile to be open (`gp`) and Notes to be available on your account. The commands open and close Instagram's controls; they do not share a note or post, change a photo, or delete an existing note. Closing uses Instagram's Close action, leaving any unsaved-draft confirmation to you. The selectors support Instagram's English desktop interface.

Story chords require Home to be open (`gh`) with no dialog. They count available story buttons in the rendered tray from left to right, including seen stories, and exclude the Create story and tray navigation controls. Numbers must be positive integers; unavailable positions report an error.

`hsrN` leaves the reply editor ready for you to type and send. Stories with replies disabled report an error. Action arguments use screaming snake case: `hs.N` sends `['STORY', '$1']`, while `hsrN` sends `['STORY_REPLY', '$1']`.

## Browser setup

The handler uses Brave's local Chrome DevTools Protocol endpoint. When the package loads or Brave launches, Chord checks the browser's debugging port. If it does not match the configured port (9222 by default), Chord gracefully terminates Brave and relaunches it with debugging enabled and `--restore-last-session`. This restarts the whole browser, including other Brave windows, because the installed Instagram app shares its browser process.

Brave appears in Chord's apps-needing-relaunch settings until a launch with the correct port is observed. A normal browser quit stays quit. Open the installed Instagram app normally after the restart; if a chord runs before the browser is ready, try it again once Instagram is open. When multiple Instagram pages are open, the handler selects the focused one; unrelated pages never receive a command.

Automatic relaunch supports a single Brave instance using its standard user-data directory. Extra instances or a custom `--user-data-dir` require manual setup. To enable debugging manually, quit Brave and run:

```sh
open -na 'Brave Browser' --args --remote-debugging-port=9222 --restore-last-session
```

For another port, configure the handler argument; automatic relaunch uses that same port:

```toml
[on.instagram]
file = 'instagram.js'
args = [9333]
```

## Development

Build in this package with `vp pack`. From the monorepo root, run `vp fmt @keychord/chords-instagram`, `vp check @keychord/chords-instagram`, and `vp run --filter @keychord/chords-instagram test`.

The tests cover every TOML binding, the serialized page payload, navigation and dialogs, page isolation, ordered commands, protocol errors, socket timeouts, and Brave's automatic relaunch lifecycle.

The recorded Notes control walkthrough is [instagram-controls-20261012.yaml](https://github.com/KeyChord/chords/blob/main/.argent/flows/instagram-controls-20261012.yaml). From the monorepo root, replay it with:

```sh
argent flow run instagram-controls-20261012 --device chromium-cdp-9222
```

Select the signed-in Instagram app first, with your own profile open, the `Note...` bubble visible, no existing note, and no open dialog. The flow opens and closes the empty editor using text selectors.
