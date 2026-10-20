# LiveSplit One chords

Commands for the [LiveSplit One](https://github.com/LiveSplit/LiveSplitOne) desktop app. To install, in [Chord](https://github.com/KeyChord/Chord) open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, then tick `@keychord/chords-livesplit` under **Packages to use**.

App bindings live in `chords/org/livesplit/one/macos.toml`, the app ID of LiveSplit One's `.app` bundle. The macOS release is a bare executable that macOS reports without a bundle identifier, so the file also claims it by name with `executables = ['LiveSplit One']`. Chord resolves such claims from the version that adds them (see "App IDs" in Chord's `scripting.md`); earlier versions activate these chords only for the bundled app.

| Chord  | Action                                                  |
| ------ | ------------------------------------------------------- |
| `v,tm` | Toggle showing every time in the layout in milliseconds |

`v,tm` switches every time accuracy in the current layout to milliseconds: the Splits component's split, segment and delta times, the Timer, the Detailed Timer's timers and comparison times, and components such as Previous Segment, Sum of Best and Possible Time Save. Pressing it again restores the accuracies it replaced, or livesplit-core's defaults when it has no record of them. The chord saves the layout unless it already had unsaved changes, in which case the toggle is applied but left unsaved alongside them. It refuses to run while the layout editor is open, because closing the editor would replace the change.

LiveSplit One also offers these accuracies one at a time under **Layout → Edit**, for example the Splits component's **Split Time Accuracy**.

## How it works

LiveSplit One renders its interface in a `WKWebView` that cannot be inspected, so this package loads a small bridge library, `target/aarch64-apple-darwin/livesplit-bridge/livesplit-bridge.dylib`, into the running app. The bridge listens on `keychord-livesplit-<pid>.sock` in the user's temporary directory (`getconf DARWIN_USER_TEMP_DIR`), accepts connections only from the same user, and runs each request's JavaScript in the app's page. The chord then changes the layout through LiveSplit One's own layout API and storage, without modifying the app on disk.

The first chord after LiveSplit One starts loads the bridge with `lldb` (`process load`), which needs the Xcode Command Line Tools. Attaching takes a few seconds, during which LiveSplit One's app process, including its global hotkeys, is paused; the timer display keeps running in WebKit's content process. Later chords take well under a second.

To avoid `lldb`, start LiveSplit One with the bridge already loaded:

```sh
DYLD_INSERT_LIBRARIES="$PWD/target/aarch64-apple-darwin/livesplit-bridge/livesplit-bridge.dylib" "/Applications/LiveSplit One"
```

Run this from the package directory, or use the absolute path of the installed package.

The handler finds LiveSplit One by its executable name, `LiveSplit One`. For a renamed executable, configure it in the chord file:

```toml
[on.livesplit]
file = 'livesplit.js'
args = ['LiveSplit One Nightly']
```

## Development

Use `vp run build:bridge` from this package directory to rebuild the bridge from `native/livesplit-bridge.m`, `vp pack` to build the JavaScript, and `vp run test` (`bun test --isolate`) to run the tests. Commit the rebuilt bridge; a test checks that it matches its source. The tests run the serialized page payload against a fake LiveSplit One component tree, exercise the bridge client against a real Unix socket with stubbed `ps` and `lldb`, and validate the TOML binding.
