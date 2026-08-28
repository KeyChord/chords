/**
 * macOS menu bar handler: a thin `bun:ffi` binding over the Swift implementation in
 * `src/ffi/menu/menu.swift`, which `@keychord/config` compiles to
 * `target/<triple>/menu/menu.dylib`. Chord runs handlers on Bun, so the library is
 * opened in-process — no helper process, no `osascript` round trip.
 *
 * The library is located through Chord's `chord` module (`resolveFfiPath`), which knows the
 * package layout (including vendored copies), so nothing here depends on where the package is
 * installed.
 */
import { resolveFfiPath } from "chord";
import { CString, dlopen, FFIType, ptr } from "bun:ffi";

export type MenuAction = "by-index" | "by-letters";

export type MenuHandler = {
  /**
   * 0-based menu bar index: 0 => the Apple menu, 1 => the application menu, 2 => the first
   * regular menu, etc.
   */
  (action: "by-index", menuIndex: number | string): void;

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
  (action: "by-letters", query: string): void;
};

type MenuLibrary = ReturnType<typeof openMenuLibrary>;

let library: MenuLibrary | undefined;

function openMenuLibrary() {
  return dlopen(resolveFfiPath(import.meta, "menu"), {
    chordsMenuRun: {
      args: [FFIType.ptr, FFIType.cstring, FFIType.cstring],
      returns: FFIType.ptr,
    },
    chordsMenuFree: {
      args: [FFIType.ptr],
      returns: FFIType.void,
    },
  });
}

/** NUL-terminated UTF-8 for a `cstring` argument. */
function cstr(value: string): Buffer {
  return Buffer.from(`${value}\0`, "utf8");
}

export function runMenuAction(processName: string | undefined, action: MenuAction, value: string): void {
  library ??= openMenuLibrary();
  // A missing process name is NULL; Bun's `cstring` arguments cannot be null, hence the raw
  // pointer for that parameter.
  const processNamePointer = processName ? ptr(cstr(processName)) : 0;
  const error = library.symbols.chordsMenuRun(processNamePointer, cstr(action), cstr(value));
  if (error) {
    const message = new CString(error).toString();
    library.symbols.chordsMenuFree(error);
    throw new Error(message);
  }
}

/**
 * Builds the `emit:menu` handler. `processName` optionally names an app to activate first;
 * without it the frontmost app's menu bar is driven. Called by Chord with `this` bound to the
 * chords-file build context and by other packages directly.
 */
export default function buildMenuHandler(processName?: string): MenuHandler {
  return function menu(action: MenuAction, value: number | string = 0) {
    runMenuAction(processName, action, String(value));
  } as MenuHandler;
}
