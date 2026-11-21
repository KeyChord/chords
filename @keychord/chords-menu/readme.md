# @keychord/chords-menu

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

One package for macOS application menus, menu-bar extras, Control Center, and menu-bar
visibility. Its chords work in whichever app is focused. [Chord](https://github.com/KeyChord/Chord)
installs this package by default, from its pinned `KeyChord/chords-menu` repository. To use the monorepo's current version documented here
instead, open Settings → Chords → **Chord Monorepos** → **Add Monorepo**, enter
`KeyChord/chords`, tick `@keychord/chords-menu` under **Packages to use**, and remove the
`KeyChord/chords-menu` entry under **Chord Repos**.

Set **Menu bar prefix** under Settings → Chords → **Placeholders** to change the
prefix for these chords. The examples below use the default, `;b`.

`;b/<text>` searches menu titles and complete menu paths using a case-insensitive,
literal substring. Spaces, punctuation, numbers, and Unicode are accepted; no final
dot is required. Exact matches and title prefixes take priority. Ambiguous results
report the matching paths so the query can include a parent menu, for example
`;b/Window > Center`.

Letter abbreviations use `;b[<letters>.`: `;b[f.` selects File,
`;b[hh.` selects the second top-level menu starting with H. In expanded menus,
`;b[zo.`, `;b[z2.`, and `;b[z-o2.` select by prefix, occurrence, and word prefix.
Letter queries exclude the Apple menu.

`;bw` opens the Window menu. `;bwq` quits the focused application
(`cmd+q`), `;bwh` hides it (`cmd+h`) and `;bwm` minimizes its window (`cmd+m`). Window-menu
commands use the same prefix: `;bwl`, `;bwr`, `;bwt`, `;bwb`, corners `;bwtl`/`;bwtr`/`;bwbl`/`;bwbr`,
arrangements `;bwlr`/`;bwrl`/`;bwtb`/`;bwbt`, `;bwx` for Quarters, `;bwo` for Return to Previous
Size, `;bwz` for Zoom, `;bwf` for Fill, `;bwc` for Center, `;bwfl`/`;bwfr` for full-screen tiling,
and `;bwaf` for Bring All to Front. They invoke exact Window-menu paths. Availability and labels
depend on the application and macOS language. `@keychord/chords-windows` provides
native window commands under `;w`.

Tray selection uses `;b<index>` from the left and `;b-<index>` from the right, starting
at 1. Typing previews by moving the pointer; `.` clicks and `,` right-clicks. The last
digit wins (`;b78.` selects icon 8); `l`/`r` use full indexes (`;b10l.` / `;b10r.`).
`;b]1.` is an explicit tray alias. `;b[<index>` selects application menus: `;b[0.` is Apple,
`;b[1.` the application menu, and `;b[-1.` the rightmost menu. Bare `;b0` also selects Apple.
After a number, `[`/`]` step within that group and stop at its edges. Backspace recomputes
the selection; completing input does not click again.

`;bc` opens Control Center, `;bp` Battery, `;bt` Time & Date, `;bcw` Wi-Fi, `;bcwv` toggles
Wi-Fi, and `;bcdd` toggles Dark Mode. Bare `;b-` clicks the main
display's notch and rejects on displays without one. `;bv` toggles automatic menu-bar
hiding through System Events; macOS may request Automation access on first use.
`;bvu`, `;bvd`, and `;bvm` adjust volume, `;bbu` and `;bbd` adjust brightness, and `;bq` opens
Force Quit.

```ts
import buildMenuHandler from "@keychord/chords-menu/js/menu.js";
const menu = buildMenuHandler();
await menu.call({ focusedAppId: "com.apple.Safari" }, "SEARCH", "New Window");
await menu("BY_INDEX", 1);
await menu("BY_LETTERS", "f");
await menu("BY_PATH", ["Window"]);
await menu("BY_PATH", ["File", "New Window"]);
```

`BY_INDEX` uses zero-based menu indexes. `BY_PATH` accepts one or more exact titles.
Handlers capture the resolved application's bundle identifier from Chord's context
and return promises that callers should await. Native operations run on Swift's
main actor and complete on the originating JavaScript queue.

`@input:tray` starts with an action type:

```toml
'@input:tray' = ['ITEM', 0] # First item; negative indexes count from the right
'@input:tray' = ['ITEM', -1, 'RIGHT'] # Last item, right click
'@input:tray' = ['HOVER', 0] # Move the pointer over the first tray item without clicking
'@input:tray' = ['NOTCH'] # Click the main display's hardware notch
'@input:tray' = ['BATTERY'] # Power / Battery menu
'@input:tray' = ['DATE_TIME'] # Notification Center via the clock
'@input:tray' = ['WIFI'] # Wi-Fi menu; Control Center if its icon is hidden
'@input:tray' = ['WIFI', 'TOGGLE'] # Switch Wi-Fi on/off
'@input:tray' = ['CONTROL_CENTER']
'@input:tray' = ['CONTROL_CENTER', 'DISPLAY', 'INCREASE']
'@input:tray' = ['CONTROL_CENTER', 'SOUND', 'CLICK']
```

Named tray actions use accessibility identifiers rather
than item positions. Battery and clock actions reject if their menu item is hidden or unavailable;
Wi-Fi uses Control Center as a fallback. Wi-Fi toggling presses the expanded section's power
control and reports unavailable or disabled hardware.

`DISPLAY` supports `CLICK`, `DECREASE`, `INCREASE`, `DARK_MODE`, `NIGHT_SHIFT`, `TRUE_TONE`, and `SETTINGS`.
`SOUND` supports `CLICK`, `DECREASE`, and `INCREASE`. Omitting the operation or using `CLICK` expands the
section via its heading/chevron. Adjustments use native slider increment/decrement actions; display
options toggle their accessibility controls. Controls absent on a particular Mac reject with an
unavailable-control error. Display Settings uses `;bcds`; `;bcd.` expands the section.

The exported `runMenuBarAction({ scope, index, steps, clickType? }, focusedAppId?)` powers
numeric selection. `scope` is `MENU` or `TRAY`; menu native indexes start at
Apple (0), and tray native indexes are zero-based. Negative indexes count from the right;
`steps` contains bracket movements, and omitting `clickType` previews without activating.
The selection handler forwards Chord's captured application identifier for menu discovery.
The `ITEM` / `HOVER` actions address tray icons only.

The native addon is built from `Sources/KeychordChordsMenuNativeMenu` and exposes
`runMenuAction`, `runMenuBarAction`, and `runTrayAction`. The menu, tray, and selection
handlers import `menu.node` (the `;bv` visibility handler runs `osascript` instead); the build
packages it, `libNodeAPI.dylib`, and `libAXorcistRuntime.dylib` under `js/native/<triple>/menu/`,
including when vendored into other chord packages. Requires macOS 14+ and Accessibility access.

Build with `vp pack` (Swift 6.2+). Run unit tests with `vp run test` (`bun test --isolate`)
in this directory, and real menu/tray checks in the disposable macOS VM with
`vp run test:macos -- @keychord/chords-menu` from the monorepo root.
