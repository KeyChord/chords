# @keychord/chordtest

Shared Bun and native macOS test helpers, plus a Tart VM runner for UI tests. The VM has its own desktop, and runs without a host window, audio passthrough, or clipboard sharing. UI helpers check `hw.model` and refuse to run on the physical Mac, even if `CHORD_TESTING_UI=1` is set.

From the workspace root:

```sh
vp run test:bun            # Noninteractive Bun tests; native addons are built and loaded in Bun
vp run test:macos:setup    # Download and prepare the shared macOS VM once
vp run test:macos          # Run Bun tests inside the VM, then stop the VM
vp run test:macos:status
vp run test:macos:stop
```

To choose test files, pass workspace-relative paths:

```sh
vp run test:macos -- @keychord/chords-tray/__tests__
```

Requires an Apple Silicon Mac and at least 45 GiB free for the initial image and build output. Setup uses an existing Tart installation or installs the pinned Tart 2.40.1 release after verifying its SHA-256 checksum at `~/.local/share/chords-testing/tart.app/Contents/MacOS/tart`. Use `CHORD_TESTING_TART` to select another executable. [Tart's setup documentation](https://tart.run/quick-start/) covers other installation methods.

The runner clones `ghcr.io/cirruslabs/macos-tahoe-base:latest` as `chords-testing-tahoe`, provisions Bun and Vite+, and uses the image's guest agent to execute commands. It mounts this repository read-only, copies source into `~/chords-workspace` in the guest, and runs `vp install --frozen-lockfile` there. Dependencies and build output stay in the guest. Provisioning updates accessibility permissions only in the guest and refuses physical Mac hardware.

Overrides: `CHORD_TESTING_VM_NAME`, `CHORD_TESTING_VM_IMAGE` (an image tag/digest), `CHORD_TESTING_TART`, and `TART_HOME` (VM storage on another volume). A workspace lock prevents overlapping runs against the shared VM; `.chord-testing/vm.log` contains VM boot logs. The runner refuses to take over an already running VM. Use the same `TART_HOME` for setup, test, status, and stop commands.

The base image needs a Swift compiler supporting the tested package's Swift tools version and a logged-in GUI session; Cirrus Labs images enable automatic login. VM graphics cannot reproduce all physical-display capabilities. Tests should assert an explicit unavailable-control error for absent controls, and reserve hardware-specific behavior checks for a dedicated physical test Mac.

Vitest tests preload the built-in `chord` module with `chordTestRuntime()` from
`@keychord/chordtest/vitest`. Add its `plugins` and `test` options to the Vite+ config.
Handlers use ordinary `import { click } from "chord"`; tests configure the preloaded export
with `vi.mocked(click).mockResolvedValue(undefined)` or `mockRejectedValue(...)`.
Unconfigured host actions fail explicitly, and Chord mocks reset before each test.
The runtime also supplies package-bound `import.meta.chord` path helpers, including vendored
native module paths. Production builds keep the real host import and do not include the test module.
The Rust helper and `chord bun` CLI checks remain integration tests of the real native implementation.

Helpers exported from this package:

- `buildNativeAddon` / `loadNativeAddon`: build an existing SwiftPM product and load its `.node` binary directly in Bun.
- `installChordRuntime`: supply `import.meta.chord` resolvers when Bun imports a handler source.
- `withMacOSRunLoop`: service Cocoa's main run loop during async native actions in a VM, then clean up.
- `requireMacOSVM` / `macOSUITestsEnabled`: keep live UI tests opt-in and confined to virtual hardware.
