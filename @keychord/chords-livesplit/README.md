# LiveSplit One chords

Commands for the [LiveSplit One](https://github.com/LiveSplit/LiveSplitOne) desktop and web clients. To install, in [Chord](https://github.com/KeyChord/Chord) open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter `KeyChord/chords`, then tick `@keychord/chords-livesplit` under **Packages to use**.

App bindings live in `chords/org/livesplit/one/`, using LiveSplit One's app ID. Chord 0.3.4 and later supports the Linux X11 and Windows bindings. The macOS release is a bare executable that macOS reports without a bundle identifier, so the file also claims it by name with `executables = ['LiveSplit One']`. Chord resolves such claims from the version that adds them (see "App IDs" in Chord's `scripting.md`); earlier versions activate these chords only for the bundled app.

| Chord  | Action                                                  |
| ------ | ------------------------------------------------------- |
| `v,tm` | Toggle showing every time in the layout in milliseconds |

`v,tm` switches every time accuracy in the current layout to milliseconds: the Splits component's split, segment and delta times, the Timer, the Detailed Timer's timers and comparison times, and components such as Previous Segment, Sum of Best and Possible Time Save. Pressing it again restores the accuracies it replaced, or livesplit-core's defaults when it has no record of them. The chord saves the layout unless it already had unsaved changes, in which case the toggle is applied but left unsaved alongside them. It refuses to run while the layout editor is open, because closing the editor would replace the change.

LiveSplit One also offers these accuracies one at a time under **Layout → Edit**, for example the Splits component's **Split Time Accuracy**.

## Windows setup

Exit LiveSplit One and start it from PowerShell with WebView2 debugging enabled for this launch. Run these commands from the directory containing the LiveSplit One executable.

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-address=127.0.0.1 --remote-debugging-port=9422'
Start-Process -FilePath '.\LiveSplit One.exe'
Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
```

The chord uses the local WebView2 endpoint to apply the layout change through LiveSplit One's own layout API. Programs on this computer can inspect the timer's webview while that endpoint is open. Use a dedicated loopback port for LiveSplit One. If you configure a different port, pass the same number with `args = [9423]` under `[on.livesplit]` in the Windows chord file. [WebView2 flags](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/webview-features-flags)

## Linux X11 setup

Open the [official LiveSplit One web client](https://one.livesplit.org/) in a dedicated Chromium app window. The X11 window class lets Chord select the timer while keeping normal browser chords in other windows.

```sh
google-chrome --ozone-platform=x11 --class=keychord-livesplit \
  --user-data-dir="${XDG_CONFIG_HOME:-$HOME/.config}/keychord-livesplit" \
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=9423 \
  --app=https://one.livesplit.org/
```

Use your installed Chromium command, such as `chromium`, if it differs from `google-chrome`. Keep one timer window open in this profile and focus the timer page before using `v,tm`. Use the dedicated profile for the timer only because programs on this computer can inspect pages exposed on the loopback debugging port. If you choose another port, set the same number with `args = [PORT]` under `[on.livesplit]` in the Linux chord file. [Chromium debugging profiles](https://developer.chrome.com/blog/remote-debugging-port)

The stock Linux desktop build uses WebKitGTK with its developer tools disabled. In that build, use **Layout → Edit** to set each accuracy.

## macOS setup

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
