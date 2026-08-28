# @keychord/chords-menu

Chord package for the macOS menu bar (excluding the tray, which is handled by [@keychord/chords-tray](https://github.com/KeyChord/chords-tray)).

## API

### buildMenuHandler() from `/js/menu.js`

```ts
import buildMenuHandler from "@keychord/chords-menu/js/menu.js";
const menu = buildMenuHandler(); // or buildMenuHandler("Safari") to activate an app first
menu("by-index", 1);
menu("by-letters", "f");
```

Query semantics:

- `by-index`, `n` — click menu bar item `n` (0 = Apple menu, 1 = the application menu, …)
- `by-letters`, `h` / `hh` / `hhh` — 1st/2nd/3rd top-level menu starting with `h`
- `by-letters`, `zo` / `z2` / `z-o` / `z-o2` — items of the currently expanded menu (prefix, ordinal, word-prefix)

## How it works

`src/swift/menu.swift` drives the menu bar through the Accessibility API and exports a tiny C
ABI (`chords_menu_run` / `chords_menu_free`). `@keychord/config` compiles it to
`target/<triple>/native/menu/menu.dylib` (committed, like `js/`), and `src/js/menu.ts` opens
that library with Bun's `bun:ffi` — Chord runs handlers on its embedded Bun, so the call is
in-process. The library path comes from Chord's `chord` module
(`resolveNativeLibrary(import.meta, "menu")`), which knows the package layout, so the JS never
hardcodes paths. The Swift module (`KeychordChordsMenuNativeMenu`) is also emitted so other
packages can `import` it from their own Swift code.

Build with `pnpm exec vp pack` (needs a Swift toolchain). Test outside the app with a Chord
build's CLI: `chord run scripts/run.ts by-letters f`.
