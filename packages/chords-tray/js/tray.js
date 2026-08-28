import { resolveFfiPath } from "chord";
import { CString, FFIType, dlopen } from "bun:ffi";
//#region src/js/tray.ts
/**
* Thin Bun FFI binding over the native menu-bar-extra scanner in `src/ffi/tray/tray.swift`.
* `@keychord/config` compiles the Swift source to
* `target/<triple>/tray/tray.dylib`.
*/
let library;
function openTrayLibrary() {
	return dlopen(resolveFfiPath(import.meta, "tray"), {
		chordsTrayRun: {
			args: [FFIType.i32, FFIType.cstring],
			returns: FFIType.ptr
		},
		chordsTrayFree: {
			args: [FFIType.ptr],
			returns: FFIType.void
		}
	});
}
/** NUL-terminated UTF-8 for a `cstring` argument. */
function cstr(value) {
	return Buffer.from(`${value}\0`, "utf8");
}
function runTrayAction(trayIndex, clickType = "left") {
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
function buildHandler() {
	return runTrayAction;
}
//#endregion
export { buildHandler as default, runTrayAction };
