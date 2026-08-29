/**
 * Thin Node-API binding over the native menu-bar-extra scanner in `src/swift/tray/tray.swift`.
 * `@keychord/config` compiles the Swift source to
 * `target/<triple>/tray/tray.node`.
 */
import { resolveNativeModulePath } from "chord";

export type TrayClickType = "left" | "right";

export type TrayHandler = (trayIndex: number, clickType?: TrayClickType) => void;

type TrayAddon = {
  runTrayAction(trayIndex: number, clickType: TrayClickType): void;
};

let addon: TrayAddon | undefined;

function openTrayAddon(): TrayAddon {
  const module = { exports: {} as TrayAddon };
  process.dlopen(module, resolveNativeModulePath(import.meta, "tray"));
  return module.exports;
}

export function runTrayAction(trayIndex: number, clickType: TrayClickType = "left"): void {
  addon ??= openTrayAddon();
  addon.runTrayAction(trayIndex, clickType);
}

/**
 * Builds the tray handler. Positive indexes count from the first menu-bar extra to the right of
 * the application menus; negative indexes count from the right edge.
 */
export default function buildHandler(): TrayHandler {
  return runTrayAction;
}
