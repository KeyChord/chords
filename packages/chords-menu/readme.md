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

`src/swift/menu/menu.swift` drives the menu bar through the Accessibility API and exposes
`runMenuAction` as a Node-API function with NodeSwift. `@keychord/config` compiles it to the
committed `target/<triple>/menu/menu.node` add-on, and `src/js/menu.ts` loads it in-process with
`process.dlopen`. The path comes from Chord's built-in
`resolveNativeModulePath(import.meta, "menu")`, so the handler also works when the package is
vendored inside another chord package. Chord's handler context supplies the bundle identifier of
the app for which the chord was resolved, so menu actions target that app directly instead of
re-reading the frontmost application after dispatch.

Build with `pnpm exec vp pack` (needs a Swift toolchain). Test outside the app with a Chord
build's CLI: `chord run scripts/run.ts by-letters f`.
