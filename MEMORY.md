# Project Environment

Argent environment inspection (confirmed 2026-10-13) identified a TypeScript chord-package monorepo for macOS, including desktop Chromium apps. `is_react_native`, `is_native_ios`, and `is_native_android` are all false. There is no Metro server.

Use Vite+ wrappers with pnpm@10.33.0: `vp install`, `vp check`, and `vp test`. Build all packages with `vp run build`, or a single package with `vp pack` in its directory. Bun and macOS VM checks are available through `vp run test:bun` and `vp run test:macos`. Chord's embedded runtime is available through the sibling `../Chord/apps/chord-tauri/chord` CLI.

```json
{
  "is_react_native": false,
  "is_native_ios": false,
  "is_native_android": false,
  "project_type": "TypeScript chord-package monorepo with native macOS Swift NodeSwift addons",
  "platform_support": ["macOS", "desktop Chromium"],
  "metro_port": null,
  "package_manager": "pnpm@10.33.0 via Vite+",
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
