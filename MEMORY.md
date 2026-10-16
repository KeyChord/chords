# Project Environment

Argent environment inspection (confirmed 2026-10-16) identified a TypeScript chord-package monorepo for macOS, including desktop Chromium apps. `is_react_native`, `is_native_ios`, and `is_native_android` are all false. There is no Metro server.

Use Vite+ wrappers with pnpm@12.11.2: `vp install`, `vp check`, and `vp test`. Build all packages with `vp run build`, or a single package with `vp pack` in its directory. Bun and macOS VM checks are available through `vp run test:bun` and `vp run test:macos`. Chord's embedded runtime is available through the sibling `../Chord/apps/chord-tauri/chord` CLI.

```json
{
  "is_react_native": false,
  "is_native_ios": false,
  "is_native_android": false,
  "project_type": "TypeScript chord-package monorepo with native macOS Swift NodeSwift addons",
  "platform_support": ["macOS", "desktop Chromium"],
  "metro_port": null,
  "package_manager": "pnpm@12.11.2 via Vite+",
  "tools": { "bun": "1.4.3", "node": "24.22.0" },
  "commands": {
    "install": "vp install",
    "check": "vp check",
    "test": "vp test",
    "build_all": "vp run build",
    "build_package": "vp pack (within package directory)",
    "build_menu": "vp pack (within @keychord/chords-menu)",
    "bun_tests": "vp run test:bun",
    "macos_test_setup": "vp run test:macos:setup",
    "macos_tests": "vp run test:macos",
    "menu_tray_macos_tests": "vp run test:macos -- @keychord/chords-menu",
    "native_artifact_check": "vp run native:check"
  }
}
```

## macOS VM testing

The shared `@keychord/chordtest` package exports VM lifecycle/discovery helpers, native build helpers, `testMacOSPackage`, `launchMacOSFixture`, `runChordScript`, and observable-state waits. Every `@keychord/*` package has `__tests__/macos.vm.test.ts`; discovery and the host VM runner unit test enforce coverage when new packages are added.

Use `vp run test:macos:setup` once, then `vp run test:macos` or `vp run test:macos -- @keychord/chords-click`. `vp run test:macos:list` lists selectors. The runner uses openai/tart 2.40.1, a digest-pinned Tahoe image (`87f3aa5c...`), Bun 1.4.3, Vite+ 0.1.15, a frozen source snapshot and a disposable clone per run. The baseline is `chords-testing-tahoe-87f3aa5c`; an older `chords-testing-tahoe` VM is preserved.

The real Chord executable and embedded Bun dylib are staged from the sibling build, or `CHORD_TESTING_HOST` / `CHORD_TESTING_BUN_LIBRARY` overrides. VM logs and fixture event recordings are saved in `.chord-testing/results/`. Test runs hold `.chord-testing/vm.lock`; do not take over another live process's VM. UI helpers refuse physical Mac hardware. `vp test` excludes VM/Bun-only tests and `.chord-testing` snapshots.

Selected VM runs build only the selected packages and their workspace dependencies; a full run still builds all chord packages. Shipped `target/` artifacts are copied into the guest, whose JavaScript build uses `CHORD_SKIP_NATIVE=1`.

`chords-tray` is merged into `chords-menu`, including numeric selection, system tray actions and visibility, with one shared `menu.node` addon. `=/<text>` searches literal menu titles/paths; `=[<letters>.` retains abbreviations, and `=w` invokes Window-menu paths. Wi-Fi moved to `=wi` / `=wiv`.

Window geometry in `chords-windows` uses signed single-digit shorthand. Positive values divide display extents; size `-n` uses `(n + 1)` extents, while position `-n` uses `-1/n` extents. `/w1100` fills the display; zero size axes in `/w` preserve size while positional zero selects the origin. `/wsw`, `/wsh`, `/wpx`, `/wpy` infer their named axis from Chord's input context. This package also owns `/h`, `/m`, `/q` and their `/wh`, `/wm`, `/wq` aliases. `chords-monitors` owns monitor focusing and the native monitor addon; `chords-spaces` owns Mission Control shortcuts. Dock commands remain in `chords-dock`. `/msWIDTHxHEIGHT` belongs to `chords-betterdisplay`.

Native accessibility addons import `AXorcistRuntime` from the `KeyChord/config` Swift package, declared in each `Package.swift` with `.package(url: "https://github.com/KeyChord/config.git", exact: …)`; every package must pin the same release because addons in one process share the first `libAXorcistRuntime.dylib` dyld loads. This dynamic product re-exports AXorcist (pinned to a released version) and includes a consistently pinned swift-log; linking AXorcist statically into several addons registers duplicate Objective-C classes. Build and bundle `libAXorcistRuntime.dylib` beside each addon, as with `libNodeAPI.dylib`. Main-actor work returns promises through `mainActorPromise` from the same package's `ChordNodeSupport` product, which settles them through a captured NodeAsyncQueue; do not copy it into packages or use NodeSwift `async` functions. The Apple addons now require macOS 14 / Swift 6.2. Raycast retains one raw AX attribute reader because AXorcist's optional accessors discard error codes needed to distinguish revoked permission from transient WebKit proxies. Ordered menu/chat discovery reads `AXChildren` through typed attributes because `children()` adds extra relationships. The Control Center test probe intentionally uses direct system APIs to verify production independently. Read AXValue through typed String/NSNumber attributes; the pinned AXorcist Any-returning value accessors can lose native values during generic conversion.

Menu selection and Raycast label collection use Swift Algorithms 1.2.1 for ordered deduplication. Safari and Chromium browser interfaces are generated at build time by swift-scripting-bridge, pinned to `1934001eaccb2fe15fb8dbf71b570b8805432326`; later upstream manifests declare a missing `SystemEventsScripting` target. The checked-in `SafariBrowser.sdef` and `Chromium.sdef` contain the interfaces used here, so builds do not need installed browsers. Keep generated filenames distinct from authored Swift files even when ignoring case (`Safari.swift` collides with `safari.swift` in SwiftPM's native build system). Chromium's tab-level `executeJavascript:` selector needs a small handwritten protocol because the generator treats receiver commands as application commands. The bindings use Apple's system ScriptingBridge framework; the package is a build-time dependency only. Apple-event failures go through a delegate and retain the 60-second timeout (3,600 Apple-event ticks).

The Swift package trial passed 947 unit tests, native builds, the menu VM fixture, and real Safari/Chrome execution plus deliberately denied Automation access. The temporary browser harness and logs are archived under `.chord-testing/results/swift-packages-trial/`. In a Tart VM, Apple-event requests are attributed to the resolved `tart-guest-agent` executable: grant that process access in the guest's TCC database, with its code requirement and the browser's indirect code identity. Granting only the child Chord/Bun executable is insufficient. Launch newly installed Chrome by its absolute application path until Launch Services registers its name. Safari returns an empty result for JavaScript exceptions; use an actual Apple-event failure such as revoked Automation permission to test error propagation.
