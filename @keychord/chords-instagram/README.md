# Instagram chords

For the installed Brave Instagram app (`com.brave.Browser.app.akpamiohjfcnimfljfndmaldlcfphjmp`).

| Chord  | Action                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------ |
| `gh`   | Open Home                                                                                        |
| `gr`   | Open Reels                                                                                       |
| `gm`   | Open Messages                                                                                    |
| `gs`   | Open Search, focus the input, and select the existing query                                      |
| `gc`   | Open the Create post composer                                                                    |
| `gp`   | Open your own profile                                                                            |
| `hs,N` | Click story N in Home's rendered story tray, starting at 1 (`hs,1`, `hs,2`, etc.)                |
| `pa,`  | Click the avatar on the displayed profile; on your own profile this opens the profile-photo menu |
| `pan`  | Open the note editor above your own profile avatar                                               |
| `panx` | Close the note editor                                                                            |

Notes requires your own profile to be open (`gp`) and Notes to be available on your account. The commands open and close Instagram's controls; they do not share a note or post, change a photo, or delete an existing note. Closing uses Instagram's Close action, leaving any unsaved-draft confirmation to you. The selectors support Instagram's English desktop interface.

Story chords require Home to be open (`gh`) with no dialog. They count available story buttons in the rendered tray from left to right, including seen stories, and exclude the Create story and tray navigation controls. Numbers must be positive integers; unavailable positions report an error.

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

Build in this package with `vp pack`. From the monorepo root, run `vp fmt @keychord/chords-instagram`, `vp check @keychord/chords-instagram`, and `vp test @keychord/chords-instagram`. Check source types with `vp exec tsc --noEmit --project tsconfig.json` from this package.

The tests cover every TOML binding, the serialized page payload, navigation and dialogs, page isolation, ordered commands, protocol errors, socket timeouts, and Brave's automatic relaunch lifecycle.

All nine actions were verified in the installed Instagram app through Chord's embedded Bun runtime on 2026-10-12.

The generated story action was also verified in signed-in Brave on 2026-10-12: position 2 opened the matching account's story viewer.

The recorded Notes control walkthrough is [instagram-controls-20261012.yaml](../../.argent/flows/instagram-controls-20261012.yaml). From the monorepo root, replay it with:

```sh
argent flow run instagram-controls-20261012 --device chromium-cdp-9222
```

Select the signed-in Instagram app first, with your own profile open, the `Note...` bubble visible, no existing note, and no open dialog. The flow opens and closes the empty editor using text selectors. Replay passed; its idle check reported minor animation in the editor before the Close action. No coordinate exceptions were retained.
