/**
 * Thin Node-API binding over the native menu-bar-extra scanner in `Sources/KeychordChordsTrayNativeTray/tray.swift`.
 * `@keychord/config` compiles the Swift source to
 * `target/<triple>/tray/tray.node`.
 */

export type TrayClickType = "left" | "right";

export type TrayHandler = (trayIndex: number, clickType?: TrayClickType) => Promise<void>;

type TrayAddon = {
  runTrayAction(trayIndex: number, clickType: TrayClickType): Promise<void>;
};

let addon: TrayAddon | undefined;

function openTrayAddon(): TrayAddon {
  const module = { exports: {} as TrayAddon };
  process.dlopen(module, import.meta.chord.resolveNative("tray"));
  return module.exports;
}

export function runTrayAction(trayIndex: number, clickType: TrayClickType = "left"): Promise<void> {
  addon ??= openTrayAddon();
  return addon.runTrayAction(trayIndex, clickType);
}

/**
 * Builds the tray handler. Positive indexes count from the first menu-bar extra to the right of
 * the application menus; negative indexes count from the right edge.
 */
export default function buildHandler(): TrayHandler {
  return runTrayAction;
}
