# @keychord/chordtest

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

A private development package for authors of the chord packages in the
[`KeyChord/chords`](https://github.com/KeyChord/chords) monorepo. It is not a chord package and
is not installed in Chord; it is only used from a checkout of the monorepo.

The Bun unit-test helpers and preloaded host mocks support macOS, Linux, and Windows. The Tart runner and Swift addon integration tests require an Apple Silicon Mac. The VM has its own desktop, and runs without a host window, audio passthrough, or clipboard sharing. UI helpers check `hw.model` and refuse to run on the physical Mac, even if `CHORD_TESTING_UI=1` is set.

From the workspace root:

```sh
vp run test                # Every package's noninteractive Bun unit tests (bun test --isolate)
vp run test:macos:setup    # Download and prepare the shared macOS VM once
vp run test:macos          # Run Bun tests inside the VM, then stop the VM
vp run test:macos:status
vp run test:macos:stop
vp run test:macos:list     # List every package's VM test entry point
```

To choose test files, pass workspace-relative paths:

```sh
vp run test:macos -- @keychord/chords-click
```

Requires an Apple Silicon Mac and at least 45 GiB free for the initial image and build output. Setup uses an existing Tart installation or installs the pinned [openai/tart 2.40.1 release](https://github.com/openai/tart/releases/tag/2.40.1) after verifying its SHA-256 checksum at `~/.local/share/chords-testing/tart.app/Contents/MacOS/tart`. Use `CHORD_TESTING_TART` to select another executable. The Homebrew alternative is `brew install openai/tools/tart`.

The runner pins the macOS 27 (Golden Gate) base image to digest `sha256:4859ea9483a1f6e377301f23a5243798044266a373fc36635e9dcd045e09292f` as `chords-testing-golden-gate-4859ea94`, provisions Bun 1.4.4 and Vite+ 1.7.0, and caches locked dependencies in this baseline. Each test command clones the stopped baseline and deletes its own clone afterward.

It freezes the chords workspace and mounts the snapshot and Chord runtime read-only.
The guest installs locked dependencies in `~/chords-workspace`. If the lockfile links
`../config`, the runner also snapshots, installs and builds that sibling checkout.
Dependencies and build output stay in the guest. Provisioning grants Accessibility
only in the guest. The runner writes logs to `.chord-testing/results/tests.log`.
Tests ending in `.session.vm.test.ts` each get their own clone and log because
locking the screen or signing out ends the interactive session.

Build Chord in the sibling `../Chord` checkout before setup, or set `CHORD_TESTING_HOST` to the actual Chord executable. Its `libbun_embed.dylib` is normally found beside the executable under `../Frameworks`; set `CHORD_TESTING_BUN_LIBRARY` if it lives elsewhere. Setup stages these files in `.chord-testing/runtime/`, and the guest uses its own copies.

Behavior suites that call `withChordPackage` load the checked-in package in a running
Chord app and invoke its sequences through the Chord CLI. They need a complete
`/Applications/Chord.app`. Set `CHORD_TESTING_APP` to use another build. They can use
`withMacOSProbe` to observe menu items, window state and application focus independently.
Spotlight's launcher needs the default macOS 27 guest for a positive search test. The Accessibility
Inspector tests need a guest with Xcode's Accessibility Inspector installed.

Every `@keychord/*` package has `__tests__/macos.vm.test.ts`. The runner discovers these files rather than maintaining a package list. Full-suite discovery rejects a new package without a VM entry point; the host runner unit test also checks this coverage. Definition-only packages validate their TOML; packages with handlers also import their production JS; native packages compile and load their actual Swift addons. Click and menu packages exercise controlled AppKit fixture apps; tray tests also run their native Control Center checks. Browser and IDE smoke tests do not require accounts or third-party applications.

Overrides: `CHORD_TESTING_VM_NAME`, `CHORD_TESTING_VM_IMAGE` (an image tag/digest), `CHORD_TESTING_TART`, and `TART_HOME` (VM storage on another volume). A workspace lock prevents overlapping runs against the shared VM; `.chord-testing/vm.log` contains VM boot logs. The runner refuses to take over an already running VM. Use the same `TART_HOME` for setup, test, status, and stop commands.

Use an image digest for repeatable image overrides. Give a different image its own VM name; setup preserves existing named VMs. Source changes are copied into each clone, and native builds reuse the baseline's compiler cache while rebuilding changed sources.

The base image needs a Swift compiler supporting the tested package's Swift tools version and a logged-in GUI session; Cirrus Labs images enable automatic login. VM graphics cannot reproduce all physical-display capabilities. Tests should assert an explicit unavailable-control error for absent controls, and reserve hardware-specific behavior checks for a dedicated physical test Mac.

Unit tests run with `bun test`, like Chord's handlers run under Bun. Each package preloads the
test runtime in `bunfig.toml` and runs `bun test --isolate` (`vp run test`), so every test file
gets a fresh global and module registry:

```toml
[test]
preload = ["@keychord/chordtest/preload"]
```

Handlers use ordinary `import { click } from "chord"`; tests configure the preloaded export
with `mocked(click).mockResolvedValue(undefined)` or `mockRejectedValue(...)`.
Unconfigured host actions fail explicitly, and Chord mocks reset before each test.
Relative `.node` imports load a stub; tests replace it with
`mock.module("../src/js/menu.node", () => ({ default: addon }))`, using the same specifier the
handler imports, and calls into an unmocked addon throw. The runtime also supplies package-bound
`import.meta.chord` path helpers, including vendored native module paths. Production builds keep
the real host import and do not include the test module.

`@keychord/chordtest/test` adds what `bun:test` lacks: `useFakeTimers` with
`advanceTimersByTimeAsync` / `runAllTimersAsync` (vitest's fake-timer semantics), `waitFor`,
`stubGlobal` / `unstubAllGlobals`, and `mocked`. Spy on `Bun` methods with `spyOn(Bun, "spawn")`
rather than replacing the global.

Helpers exported from this package:

- `buildNativeAddon` / `loadNativeAddon`: build an existing SwiftPM product and load its `.node` binary directly in Bun.
- `installChordRuntime`: supply `import.meta.chord` resolvers when Bun imports a handler source.
- `withMacOSRunLoop`: service Cocoa's main run loop during async native actions in a VM, then clean up.
- `requireMacOSVM` / `macOSUITestsEnabled`: keep live UI tests opt-in and confined to virtual hardware.
- `MacOSVM` / `vmOptions` / `withVMLock` / `discoverMacOSTests`: the same runner used by the CLI, also exported from `@keychord/chordtest/vm`.
- `testMacOSPackage`: validate a package in the actual guest; discover and build native targets automatically.
- `chordPattern`: match literal chord keys surrounding parenthesized regex captures, also exported from `@keychord/chordtest/patterns`.
- `launchMacOSFixture` / `runChordScript` / `waitFor`: create controlled AppKit apps, run integration scripts through Chord, and wait for observable fixture state. Also exported from `@keychord/chordtest/macos`.

Add a VM test in a new package with:

```ts
import { test } from "bun:test";
import { macOSUITestsEnabled, testMacOSPackage } from "@keychord/chordtest";

test.skipIf(!macOSUITestsEnabled)(
  "production package loads in the macOS VM",
  () => testMacOSPackage(import.meta.url),
  300_000,
);
```

Keep live tests in `*.vm.test.ts`, gated with `test.skipIf(!macOSUITestsEnabled)` as above, so `vp run test` skips them. Run them with `vp run test:macos`, which enables the VM flag and hardware check. Add behavior scenarios in the same file using the exported fixture helpers. Do not enable the UI flag to run these tests on a physical Mac.
