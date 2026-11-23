import { isAbsolute, join } from "node:path";

const ROOT_DEEPLINK = "raycast://";
const RPC_E_CHANGED_MODE = 0x80010106 | 0;
const COINIT_APARTMENTTHREADED = 2;
const COINIT_DISABLE_OLE1DDE = 4;
const SW_SHOWNORMAL = 1;

export function raycastDeeplink(value: string): string {
  if (value === ROOT_DEEPLINK) return value;
  const url = URL.parse(value);
  if (
    url?.protocol !== "raycast:" ||
    url.hostname !== "extensions" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !/^\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname)
  ) {
    throw new TypeError(
      "Expected a Raycast command deeplink: raycast://extensions/owner/extension/command",
    );
  }
  return url.href;
}

export default function buildRaycastWindowsHandler() {
  return async function openRaycast(value = ROOT_DEEPLINK): Promise<void> {
    const url = raycastDeeplink(value);
    if (process.platform !== "win32") throw new Error("This Raycast handler requires Windows");
    const windowsDirectory = process.env.SystemRoot;
    if (!windowsDirectory || !isAbsolute(windowsDirectory)) {
      throw new Error("Cannot locate the Windows system directory");
    }

    const { dlopen } = await import("bun:ffi");
    const system32 = join(windowsDirectory, "System32");
    const com = dlopen(join(system32, "ole32.dll"), {
      CoInitializeEx: { args: ["ptr", "u32"], returns: "i32" },
      CoUninitialize: { args: [], returns: "void" },
    });
    const initialized = com.symbols.CoInitializeEx(
      null,
      COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE,
    );
    try {
      if (initialized < 0 && initialized !== RPC_E_CHANGED_MODE) {
        throw new Error(`Could not initialize Windows Shell support (${initialized})`);
      }
      const shell = dlopen(join(system32, "shell32.dll"), {
        ShellExecuteW: { args: ["ptr", "ptr", "ptr", "ptr", "ptr", "i32"], returns: "u64" },
      });
      try {
        const uri = Buffer.from(`${url}\0`, "utf16le");
        const result = shell.symbols.ShellExecuteW(null, null, uri, null, null, SW_SHOWNORMAL);
        if (result <= 32n) {
          throw new Error(
            `Windows could not open Raycast (ShellExecuteW code ${result}). Check that Raycast is installed and its protocol is registered.`,
          );
        }
      } finally {
        shell.close();
      }
    } finally {
      if (initialized >= 0) com.symbols.CoUninitialize();
      com.close();
    }
  };
}
