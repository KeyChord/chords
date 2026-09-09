# @keychord/chords-menu

Chord package for the macOS menu bar (excluding the tray, which is handled by [@keychord/chords-tray](https://github.com/KeyChord/chords-tray)).

## API

### buildMenuHandler() from `/js/menu.js`

```ts
import buildMenuHandler from "@keychord/chords-menu/js/menu.js";
const menu = buildMenuHandler(); // or buildMenuHandler("Safari") to activate an app first
await menu("by-index", 1);
await menu("by-letters", "f");
await menu("by-path", ["File", "New Window"]);
```

Query semantics:

- `by-path`, `["File", "New Window"]` — exact menu titles, including nested submenus
- `by-index`, `n` — click menu bar item `n` (0 = Apple menu, 1 = the application menu, …)
- `by-letters`, `h` / `hh` / `hhh` — 1st/2nd/3rd top-level menu starting with `h`
- `by-letters`, `zo` / `z2` / `z-o` / `z-o2` — items of the currently expanded menu (prefix, ordinal, word-prefix)

`-0` always targets the Apple menu. Letter queries exclude the system Apple menu, so `-a`
selects the first application menu starting with A (or reports no match).

## How it works

`Sources/KeychordChordsMenuNativeMenu/menu.swift` drives the menu bar through AXorcist on Swift’s `@MainActor` and exposes
`runMenuAction` as an async Node-API function with NodeSwift. `@keychord/config` compiles it to the
committed `target/<triple>/menu/menu.node` add-on, and `src/js/menu.ts` loads it in-process with
`process.dlopen`. The path comes from Chord's built-in
`import.meta.chord.resolveNative("menu")`, so the handler also works when the package is
vendored inside another chord package. Chord's handler context supplies the bundle identifier of
the app for which the chord was resolved, so menu actions target that app directly instead of
re-reading the frontmost application after dispatch.

Menu calls return `Promise<void>`; direct callers must return or await them. Chord awaits handler
Promises automatically. Use a Chord build with main-run-loop support in its CLI (the same
requirement as other `@MainActor` native libraries).

Requires macOS 14 or later. Build with `pnpm exec vp pack` (Swift 6.2 or later).
AXorcist is pinned in `vite.config.ts`. The workspace currently links the sibling `../config`
checkout for Swift package dependency support; build that checkout with `pnpm exec vp pack`
after editing its source. Test outside the app with a Chord
build's CLI: `chord bun scripts/run.ts by-letters f`.

## Regression check

After building, run `python3 tests/check.py /path/to/chord` from this package. It launches a
temporary menu fixture app and verifies indices, repeated letters, expanded-item occurrences,
word abbreviations, nested exact paths, invisible-title cleanup, disabled items, rejection, and
captured app context. It also checks Apple menu selection by zero and excludes the system Apple
menu from A-prefixed matches. Chord needs Accessibility permission. The fixture closes after the check.

Run `vp test` for the binding test without launching a fixture app.
