/**
 * Thin Bun FFI binding over the native menu-bar-extra scanner in `src/ffi/tray/tray.swift`.
 * `@keychord/config` compiles the Swift source to
 * `target/<triple>/tray/tray.dylib`.
 */
import { resolveFfiPath } from "chord";
import { CString, dlopen, FFIType } from "bun:ffi";

export type TrayClickType = "left" | "right";

export type TrayHandler = (trayIndex: number, clickType?: TrayClickType) => void;

type TrayLibrary = ReturnType<typeof openTrayLibrary>;

let library: TrayLibrary | undefined;

function openTrayLibrary() {
  return dlopen(resolveFfiPath(import.meta, "tray"), {
    chordsTrayRun: {
      args: [FFIType.i32, FFIType.cstring],
      returns: FFIType.ptr,
    },
    chordsTrayFree: {
      args: [FFIType.ptr],
      returns: FFIType.void,
    },
  });
}

/** NUL-terminated UTF-8 for a `cstring` argument. */
function cstr(value: string): Buffer {
  return Buffer.from(`${value}\0`, "utf8");
}

export function runTrayAction(trayIndex: number, clickType: TrayClickType = "left"): void {
  library ??= openTrayLibrary();
  const error = library.symbols.chordsTrayRun(trayIndex, cstr(clickType));
  if (error) {
    const message = new CString(error).toString();
    library.symbols.chordsTrayFree(error);
    throw new Error(message);
  }
}

/**
 * Builds the tray handler. Positive indexes count from the first menu-bar extra to the right of
 * the application menus; negative indexes count from the right edge.
 */
export default function buildHandler(): TrayHandler {
  return runTrayAction;
}
