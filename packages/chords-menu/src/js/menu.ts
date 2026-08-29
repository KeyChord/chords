/**
 * macOS menu bar handler: a thin Node-API binding over the Swift implementation in
 * `src/swift/menu/menu.swift`, which `@keychord/config` compiles to
 * `target/<triple>/menu/menu.node`. Chord runs handlers on Bun, so the addon is
 * opened in-process — no helper process, no `osascript` round trip.
 *
 * The addon is located through Chord's `chord` module (`resolveNativeModulePath`), which knows the
 * package layout (including vendored copies), so nothing here depends on where the package is
 * installed.
 */
import { resolveNativeModulePath } from "chord";

export type MenuAction = "by-index" | "by-letters";

export type MenuHandlerContext = {
  /** Bundle identifier captured by Chord when it resolved the chord. */
  focusedAppId?: string;
};

export type MenuHandler = {
  /**
   * 0-based menu bar index: 0 => the Apple menu, 1 => the application menu, 2 => the first
   * regular menu, etc.
   */
  (this: MenuHandlerContext | void, action: "by-index", menuIndex: number | string): void;

  /**
   * Lowercase-only query language:
   *
   * Top-level menus:
   * - "h"   => 1st menu starting with "h"
   * - "hh"  => 2nd menu starting with "h"
   * - "hhh" => 3rd menu starting with "h"
   *
   * Expanded menu items:
   * - "z"     => 1st expanded menu item starting with "z"
   * - "zo"    => 1st expanded menu item starting with "zo"
   * - "z2"    => 2nd expanded menu item starting with "z"
   * - "z-o"   => 1st expanded menu item matching word-prefixes "z" + "o"
   * - "z-o2"  => 2nd expanded menu item matching word-prefixes "z" + "o"
   */
  (this: MenuHandlerContext | void, action: "by-letters", query: string): void;
};

type MenuAddon = {
  runMenuAction(processName: string | undefined, action: MenuAction, value: string): void;
};

let addon: MenuAddon | undefined;

function openMenuAddon(): MenuAddon {
  const module = { exports: {} as MenuAddon };
  process.dlopen(module, resolveNativeModulePath(import.meta, "menu"));
  return module.exports;
}

export function runMenuAction(
  processName: string | undefined,
  action: MenuAction,
  value: string,
): void {
  addon ??= openMenuAddon();
  addon.runMenuAction(processName, action, value);
}

/**
 * Builds the `emit:menu` handler. `processName` optionally names an app to activate first.
 * Otherwise Chord's captured focused-app bundle identifier is used, avoiding a race with Chord's
 * panel temporarily becoming frontmost. Direct callers without an invocation context retain the
 * frontmost-app fallback.
 */
export default function buildMenuHandler(processName?: string): MenuHandler {
  return function menu(
    this: MenuHandlerContext | void,
    action: MenuAction,
    value: number | string = 0,
  ) {
    runMenuAction(processName ?? this?.focusedAppId, action, String(value));
  } as MenuHandler;
}
