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

export type MenuAction = "by-index" | "by-letters" | "by-path";

/** An exact menu path, starting at a top-level menu and ending at the item to invoke. */
export type MenuPath = readonly [menu: string, item: string, ...subitems: string[]];

export type MenuHandlerContext = {
  /** Bundle identifier captured by Chord when it resolved the chord. */
  focusedAppId?: string;
};

/** Resolves when the native action completes; rejects on validation or accessibility errors. */
export type MenuHandler = {
  /**
   * 0-based menu bar index: 0 => the Apple menu, 1 => the application menu, 2 => the first
   * regular menu, etc.
   */
  (this: MenuHandlerContext | void, action: "by-index", menuIndex: number | string): Promise<void>;

  /**
   * Lowercase-only query language:
   *
   * Top-level menus:
   * The Apple menu is excluded; select it with by-index 0.
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
  (this: MenuHandlerContext | void, action: "by-letters", query: string): Promise<void>;

  /**
   * Exact menu titles from the menu bar down to the item to invoke. For example:
   * `["Window", "Move Tab to New Window"]`.
   */
  (this: MenuHandlerContext | void, action: "by-path", path: MenuPath): Promise<void>;
};

type MenuAddon = {
  runMenuAction(processName: string | undefined, action: MenuAction, value: string): Promise<void>;
};

let addon: MenuAddon | undefined;

function openMenuAddon(): MenuAddon {
  const module = { exports: {} as MenuAddon };
  process.dlopen(module, resolveNativeModulePath(import.meta, "menu"));
  return module.exports;
}

export async function runMenuAction(
  processName: string | undefined,
  action: MenuAction,
  value: number | string | MenuPath,
): Promise<void> {
  addon ??= openMenuAddon();
  if (action === "by-path") {
    if (
      !Array.isArray(value) ||
      value.length < 2 ||
      value.some((component) => typeof component !== "string" || component.trim().length === 0)
    ) {
      throw new TypeError('"by-path" expects at least two non-empty string components');
    }
    return addon.runMenuAction(processName, action, JSON.stringify(value));
  }
  return addon.runMenuAction(processName, action, String(value));
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
    value: number | string | MenuPath = 0,
  ) {
    return runMenuAction(processName ?? this?.focusedAppId, action, value);
  } as MenuHandler;
}
