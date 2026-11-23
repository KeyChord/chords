import { r as targetDisplay, t as center } from "./layout-79vuwJn2.js";
import { JSCallback, dlopen } from "bun:ffi";
import { join } from "node:path";
//#region src/js/desktop-monitor/windows.ts
const MONITORINFO_INTS = 10;
const MONITORINFO_PRIMARY = 1;
const PER_MONITOR_AWARE_V2 = -4n;
const MONITOR_DEFAULTTONULL = 0;
const GWL_EXSTYLE = -20;
const DWMWA_CLOAKED = 14;
function native() {
	const system32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32");
	const user = dlopen(join(system32, "user32.dll"), {
		EnumDisplayMonitors: {
			args: [
				"u64",
				"ptr",
				"callback",
				"i64"
			],
			returns: "i32"
		},
		GetMonitorInfoW: {
			args: ["u64", "ptr"],
			returns: "i32"
		},
		GetCursorPos: {
			args: ["ptr"],
			returns: "i32"
		},
		SetCursorPos: {
			args: ["i32", "i32"],
			returns: "i32"
		},
		SetThreadDpiAwarenessContext: {
			args: ["i64"],
			returns: "i64"
		},
		EnumWindows: {
			args: ["callback", "i64"],
			returns: "i32"
		},
		GetWindowLongPtrW: {
			args: ["u64", "i32"],
			returns: "i64"
		},
		GetShellWindow: {
			args: [],
			returns: "u64"
		},
		GetForegroundWindow: {
			args: [],
			returns: "u64"
		},
		IsWindowVisible: {
			args: ["u64"],
			returns: "i32"
		},
		IsIconic: {
			args: ["u64"],
			returns: "i32"
		},
		MonitorFromWindow: {
			args: ["u64", "u32"],
			returns: "u64"
		},
		SetForegroundWindow: {
			args: ["u64"],
			returns: "i32"
		}
	});
	const { symbols: dwm } = dlopen(join(system32, "dwmapi.dll"), { DwmGetWindowAttribute: {
		args: [
			"u64",
			"u32",
			"ptr",
			"u32"
		],
		returns: "i32"
	} });
	return {
		user: user.symbols,
		dwm
	};
}
let library;
function frame(info, offset) {
	const x = info[offset];
	const y = info[offset + 1];
	return {
		x,
		y,
		width: info[offset + 2] - x,
		height: info[offset + 3] - y
	};
}
function focusWindows(target) {
	const { user, dwm } = library ??= native();
	const previousDpi = user.SetThreadDpiAwarenessContext(PER_MONITOR_AWARE_V2);
	if (!previousDpi) throw new Error("Could not select physical display coordinates");
	try {
		const displays = [];
		const info = new Int32Array(MONITORINFO_INTS);
		info[0] = info.byteLength;
		const monitor = new JSCallback((handle) => {
			if (user.GetMonitorInfoW(handle, info)) displays.push({
				...frame(info, 1),
				workArea: frame(info, 5),
				primary: (info[9] & MONITORINFO_PRIMARY) !== 0,
				handle
			});
			return 1;
		}, {
			args: [
				"u64",
				"u64",
				"ptr",
				"i64"
			],
			returns: "i32"
		});
		try {
			if (!user.EnumDisplayMonitors(0n, null, monitor.ptr, 0n)) throw new Error("Could not enumerate monitors");
		} finally {
			monitor.close();
		}
		const pointer = /* @__PURE__ */ new Int32Array(2);
		if (!user.GetCursorPos(pointer)) throw new Error("Could not read the pointer");
		const display = targetDisplay(displays, target, {
			x: pointer[0],
			y: pointer[1]
		});
		const shellWindow = user.GetShellWindow();
		const cloak = /* @__PURE__ */ new Uint32Array(1);
		let candidate = 0n;
		const window = new JSCallback((handle) => {
			if (handle === shellWindow || !user.IsWindowVisible(handle) || user.IsIconic(handle)) return 1;
			if (user.MonitorFromWindow(handle, MONITOR_DEFAULTTONULL) !== display.handle) return 1;
			if (user.GetWindowLongPtrW(handle, GWL_EXSTYLE) & 134217856n) return 1;
			if (dwm.DwmGetWindowAttribute(handle, DWMWA_CLOAKED, cloak, cloak.byteLength) !== 0 || cloak[0]) return 1;
			candidate = handle;
			return 0;
		}, {
			args: ["u64", "i64"],
			returns: "i32"
		});
		try {
			if (!user.EnumWindows(window.ptr, 0n) && !candidate) throw new Error("Could not enumerate windows");
		} finally {
			window.close();
		}
		const { x, y } = center(display.workArea ?? display);
		if (!user.SetCursorPos(x, y)) throw new Error("Could not move the pointer to the monitor");
		if (candidate && candidate !== user.GetForegroundWindow() && !user.SetForegroundWindow(candidate)) throw new Error("Windows did not allow the selected window to receive focus");
	} finally {
		user.SetThreadDpiAwarenessContext(previousDpi);
	}
}
//#endregion
export { focusWindows };
