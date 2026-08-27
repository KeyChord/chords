# @keychord/chords-menu

Chord package for the macOS menu bar (excluding the tray, which is handled by [@keychord/chords-tray](https://github.com/KeyChord/chords-tray)).

## API

### buildMenuHandler() from `/js/menu.js`

```ts
import buildMenuHandler from "@keychord/chords-menu/js/menu.js";
const menu = buildMenuHandler();
```

## Native handler

`chords/macos.toml` uses the native handler built from `src/swift/menu.swift` into `target/<triple>/native/menu/` (`menu.dylib` plus the `KeychordChordsMenuNativeMenu` Swift module, which other packages can `import`). It drives the menu bar through the Accessibility API directly instead of JXA. `src/js/menu.ts` is kept as the reference implementation and remains importable as shown above.

Query semantics are identical for both:

- `by-index`, `n` — click menu bar item `n` (0 = Apple menu, 1 = the application menu, …)
- `by-letters`, `h` / `hh` / `hhh` — 1st/2nd/3rd top-level menu starting with `h`
- `by-letters`, `zo` / `z2` / `z-o` / `z-o2` — items of the currently expanded menu (prefix, ordinal, word-prefix)

Build with `pnpm exec vp pack`; test with `chord native-run target/aarch64-apple-darwin/native/menu/menu.dylib --event-arg by-letters --event-arg f`.
