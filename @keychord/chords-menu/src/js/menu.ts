/**
 * macOS menu bar handler: a thin Node-API binding over the Swift implementation in
 * `Sources/KeychordChordsMenuNativeMenu/menu.swift`, which `@keychord/config` compiles to
 * `target/<triple>/menu/menu.node`. Chord runs handlers on Bun, so the addon is
 * opened in-process — no helper process, no `osascript` round trip.
 *
 * `@keychord/config` resolves the native import and packages the addon with its runtime,
 * including when the JavaScript bundle is vendored into another package.
 */
import addon from "./menu.node";

export type MenuAction = "BY_INDEX" | "BY_LETTERS" | "BY_PATH" | "SEARCH";

/** An exact menu path, starting at a top-level menu and ending at the item to invoke. */
export type MenuPath = readonly [menu: string, ...subitems: string[]];

export type MenuHandlerContext = {
  /** Bundle identifier captured by Chord when it resolved the chord. */
  focusedAppId?: string;
};

export type MenuArguments =
  | [action: "BY_INDEX", menuIndex: number | string]
  | [action: "BY_LETTERS" | "SEARCH", query: string]
  | [action: "BY_PATH", path: MenuPath];

/** Resolves when the native action completes; rejects on validation or accessibility errors. */
export type MenuHandler = {
  /**
   * 0-based menu bar index: 0 => the Apple menu, 1 => the application menu, 2 => the first
   * regular menu, etc.
   */
  (this: MenuHandlerContext | void, action: "BY_INDEX", menuIndex: number | string): Promise<void>;

  /**
   * Lowercase-only query language:
   *
   * Top-level menus:
   * The Apple menu is excluded; select it with BY_INDEX 0.
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
  (this: MenuHandlerContext | void, action: "BY_LETTERS", query: string): Promise<void>;
  (this: MenuHandlerContext | void, action: "SEARCH", query: string): Promise<void>;

  /**
   * Exact menu titles from the menu bar down to the item to invoke. For example:
   * `["Window", "Move Tab to New Window"]`.
   */
  (this: MenuHandlerContext | void, action: "BY_PATH", path: MenuPath): Promise<void>;
  (this: MenuHandlerContext | void, ...args: MenuArguments): Promise<void>;
};

export async function runMenuAction(
  processName: string | undefined,
  action: MenuAction,
  value: number | string | MenuPath,
): Promise<void> {
  if (action === "BY_PATH") {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.some((component) => typeof component !== "string" || component.trim().length === 0)
    ) {
      throw new TypeError('"BY_PATH" expects at least one non-empty string component');
    }
    return addon.runMenuAction(processName, action, JSON.stringify(value));
  }
  if (action === "SEARCH" && (typeof value !== "string" || !value.trim())) {
    throw new TypeError('"search" expects non-empty text');
  }
  return addon.runMenuAction(processName, action, String(value));
}

/**
 * Builds the `@input:menu` handler. `processName` optionally names an app to activate first.
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
