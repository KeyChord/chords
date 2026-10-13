# Project Environment

Argent environment inspection (confirmed 2026-10-13) identified a TypeScript chord-package monorepo for macOS, including desktop Chromium apps. `is_react_native`, `is_native_ios`, and `is_native_android` are all false. There is no Metro server.

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
  "tools": { "bun": "1.4.3", "node": "24.21.0" },
  "commands": {
    "install": "vp install",
    "check": "vp check",
    "test": "vp test",
    "build_all": "vp run build",
    "build_package": "vp pack (within package directory)",
    "bun_tests": "vp run test:bun",
    "macos_test_setup": "vp run test:macos:setup",
    "macos_tests": "vp run test:macos",
    "native_artifact_check": "vp run native:check"
  }
}
```

## macOS VM testing

The shared `@keychord/chordtest` package exports VM lifecycle/discovery helpers, native build helpers, `testMacOSPackage`, `launchMacOSFixture`, `runChordScript`, and observable-state waits. Every `@keychord/*` package has `__tests__/macos.vm.test.ts`; discovery and the host VM runner unit test enforce coverage when new packages are added.

Use `vp run test:macos:setup` once, then `vp run test:macos` or `vp run test:macos -- @keychord/chords-click`. `vp run test:macos:list` lists selectors. The runner uses openai/tart 2.40.1, a digest-pinned Tahoe image (`87f3aa5c...`), Bun 1.4.3, Vite+ 0.1.15, a frozen source snapshot and a disposable clone per run. The baseline is `chords-testing-tahoe-87f3aa5c`; an older `chords-testing-tahoe` VM is preserved.

The real Chord executable and embedded Bun dylib are staged from the sibling build, or `CHORD_TESTING_HOST` / `CHORD_TESTING_BUN_LIBRARY` overrides. VM logs and fixture event recordings are saved in `.chord-testing/results/`. Test runs hold `.chord-testing/vm.lock`; do not take over another live process's VM. UI helpers refuse physical Mac hardware. `vp test` excludes VM/Bun-only tests and `.chord-testing` snapshots.
