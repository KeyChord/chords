# @keychord/chordtest

Shared Bun and native macOS test helpers, plus a Tart VM runner for UI tests. The VM has its own desktop, and runs without a host window, audio passthrough, or clipboard sharing. UI helpers check `hw.model` and refuse to run on the physical Mac, even if `CHORD_TESTING_UI=1` is set.

From the workspace root:

```sh
vp run test:bun            # Noninteractive Bun tests; native addons are built and loaded in Bun
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

The runner pins the Tahoe base image to digest `sha256:87f3aa5ce21b5c876268f233bdfecf38b4c2a8116fe9bbb718e714cbae187377` as `chords-testing-tahoe-87f3aa5c`, provisions Bun 1.4.3 and Vite+ 0.1.15, and caches dependency installation and native compilation in this prepared baseline. Every test command clones that stopped baseline into a disposable VM and deletes only its own clone afterward. UI changes and test files from one run cannot affect the next run.

It freezes snapshots of the chords workspace and sibling `../config` checkout, mounts those and the Chord runtime read-only, and copies source into `~/chords-workspace` and `~/config` in the guest. A guest-local `~/chords` link preserves the config's workspace override. The guest installs both checkouts with `vp install --frozen-lockfile` and rebuilds the shared config. Dependencies and build output stay in the guest. Provisioning grants accessibility permission only in the guest and refuses physical Mac hardware. The guest runs production package bundles with the real built-in `chord` module, not the Vitest mocks. Its logs are copied to `.chord-testing/results/tests.log` on the host.

Build Chord in the sibling `../Chord` checkout before setup, or set `CHORD_TESTING_HOST` to the actual Chord executable. Its `libbun_embed.dylib` is normally found beside the executable under `../Frameworks`; set `CHORD_TESTING_BUN_LIBRARY` if it lives elsewhere. Setup stages these files in `.chord-testing/runtime/`, and the guest uses its own copies.

Every `@keychord/*` package has `__tests__/macos.vm.test.ts`. The runner discovers these files rather than maintaining a package list. Full-suite discovery rejects a new package without a VM entry point; the host runner unit test also checks this coverage. Definition-only packages validate their TOML; packages with handlers also import their production JS; native packages compile and load their actual Swift addons. Click and menu packages exercise controlled AppKit fixture apps; tray tests also run their native Control Center checks. Browser and IDE smoke tests do not require accounts or third-party applications.

Overrides: `CHORD_TESTING_VM_NAME`, `CHORD_TESTING_VM_IMAGE` (an image tag/digest), `CHORD_TESTING_TART`, and `TART_HOME` (VM storage on another volume). A workspace lock prevents overlapping runs against the shared VM; `.chord-testing/vm.log` contains VM boot logs. The runner refuses to take over an already running VM. Use the same `TART_HOME` for setup, test, status, and stop commands.

Use an image digest for repeatable image overrides. Give a different image its own VM name; setup preserves existing named VMs. Source changes are copied into each clone, and native builds reuse the baseline's compiler cache while rebuilding changed sources.

The base image needs a Swift compiler supporting the tested package's Swift tools version and a logged-in GUI session; Cirrus Labs images enable automatic login. VM graphics cannot reproduce all physical-display capabilities. Tests should assert an explicit unavailable-control error for absent controls, and reserve hardware-specific behavior checks for a dedicated physical test Mac.

`@keychord/config` includes the Vitest runtime by default:

```ts
import { config } from "@keychord/config";

export default config();
```

Custom Vite+ configs can use `chordTestRuntime()` from `@keychord/chordtest/vitest` directly.
It supplies the runtime plugin, `chord` alias, setup file, and VM test exclusion.
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

Keep live tests in `*.vm.test.ts`; `vp test` excludes them. Run them with `vp run test:macos`, which enables the VM flag and hardware check. Add behavior scenarios in the same file using the exported fixture helpers. Do not enable the UI flag to run these tests on a physical Mac.
