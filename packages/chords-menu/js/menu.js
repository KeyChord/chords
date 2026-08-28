import { resolveNativeLibrary } from "chord";
import { CString, FFIType, dlopen, ptr } from "bun:ffi";
//#region src/js/menu.ts
/**
* macOS menu bar handler: a thin `bun:ffi` binding over the Swift implementation in
* `src/swift/menu.swift`, which `@keychord/config` compiles to
* `target/<triple>/native/menu/menu.dylib`. Chord runs handlers on Bun, so the library is
* opened in-process — no helper process, no `osascript` round trip.
*
* The library is located through Chord's `chord` module (`resolveNativeLibrary`), which knows the
* package layout (including vendored copies), so nothing here depends on where the package is
* installed.
*/
let library;
function openMenuLibrary() {
	return dlopen(resolveNativeLibrary(import.meta, "menu"), {
		chords_menu_run: {
			args: [
				FFIType.ptr,
				FFIType.cstring,
				FFIType.cstring
			],
			returns: FFIType.ptr
		},
		chords_menu_free: {
			args: [FFIType.ptr],
			returns: FFIType.void
		}
	});
}
/** NUL-terminated UTF-8 for a `cstring` argument. */
function cstr(value) {
	return Buffer.from(`${value}\0`, "utf8");
}
function runMenuAction(processName, action, value) {
	library ??= openMenuLibrary();
	const processNamePointer = processName ? ptr(cstr(processName)) : 0;
	const error = library.symbols.chords_menu_run(processNamePointer, cstr(action), cstr(value));
	if (error) {
		const message = new CString(error).toString();
		library.symbols.chords_menu_free(error);
		throw new Error(message);
	}
}
/**
* Builds the `emit:menu` handler. `processName` optionally names an app to activate first;
* without it the frontmost app's menu bar is driven. Called by Chord with `this` bound to the
* chords-file build context and by other packages directly.
*/
function buildMenuHandler(processName) {
	return function menu(action, value = 0) {
		runMenuAction(processName, action, String(value));
	};
}
//#endregion
export { buildMenuHandler as default, runMenuAction };
