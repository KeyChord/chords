/**
 * Thin Node-API binding over the native menu-bar-extra scanner in `Sources/KeychordChordsTrayNativeTray/tray.swift`.
 * `@keychord/config` compiles the Swift source to
 * `target/<triple>/tray/tray.node`.
 */

export type TrayClickType = "left" | "right";

export type DisplayAction =
  | "CLICK"
  | "DECREASE"
  | "INCREASE"
  | "DARK_MODE"
  | "NIGHT_SHIFT"
  | "TRUE_TONE"
  | "SETTINGS";

export type SoundAction = "CLICK" | "DECREASE" | "INCREASE";

export type TrayAction =
  | [type: "ITEM", index: number, clickType?: TrayClickType]
  | [type: "BATTERY"]
  | [type: "DATE_TIME"]
  | [type: "WIFI", action?: "TOGGLE"]
  | [type: "CONTROL_CENTER"]
  | [type: "CONTROL_CENTER", section: "DISPLAY", action?: DisplayAction]
  | [type: "CONTROL_CENTER", section: "SOUND", action?: SoundAction];

export type TrayHandler = (...args: TrayAction) => Promise<void>;

type TrayAddon = {
  runTrayAction(type: string, value: string, action: string): Promise<void>;
};

let addon: TrayAddon | undefined;

function openTrayAddon(): TrayAddon {
  const module = { exports: {} as TrayAddon };
  process.dlopen(module, import.meta.chord.resolveNative("tray"));
  return module.exports;
}

export async function runTrayAction(...args: TrayAction): Promise<void> {
  const [type, value, action] = args;
  if (type === "ITEM" && !Number.isSafeInteger(value)) {
    throw new TypeError("tray index must be a safe integer");
  }
  addon ??= openTrayAddon();
  return addon.runTrayAction(
    type,
    value === undefined ? "" : String(value),
    action ?? (type === "ITEM" ? "left" : ""),
  );
}

/**
 * Builds the typed `@input:tray` handler. ITEM indexes count from the first menu-bar extra to the
 * right of the application menus; negative indexes count from the right edge. CONTROL_CENTER
 * opens the panel and optionally expands a section or operates one of its controls.
 * BATTERY and DATE_TIME activate their named menu-bar extras. WIFI opens its menu (or its
 * Control Center section when the icon is hidden); WIFI > TOGGLE switches Wi-Fi on/off.
 */
export default function buildHandler(): TrayHandler {
  return runTrayAction;
}
