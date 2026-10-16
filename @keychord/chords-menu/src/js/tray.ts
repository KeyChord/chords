/**
 * Thin Node-API binding over the native menu-bar-extra scanner in `Sources/KeychordChordsMenuNativeMenu/tray.swift`.
 * `@keychord/config` compiles the Swift source to
 * `target/<triple>/menu/menu.node`.
 */
import addon from "./menu.node";

export type TrayClickType = "LEFT" | "RIGHT";

export type MenuBarSelection = {
  scope: "MENU" | "TRAY";
  /** Menu indexes start at Apple (0); tray indexes are zero-based within the tray. */
  index: number;
  steps: string;
  clickType?: TrayClickType;
};

export async function runMenuBarAction(
  selection: MenuBarSelection,
  focusedAppId?: string,
): Promise<void> {
  if (!Number.isSafeInteger(selection.index))
    throw new TypeError("menu bar index must be a safe integer");
  return addon.runMenuBarAction(
    focusedAppId,
    selection.scope,
    String(selection.index),
    selection.steps,
    selection.clickType ?? "",
  );
}

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
  | [type: "HOVER", index: number]
  | [type: "NOTCH"]
  | [type: "BATTERY"]
  | [type: "DATE_TIME"]
  | [type: "WIFI", action?: "TOGGLE"]
  | [type: "CONTROL_CENTER"]
  | [type: "CONTROL_CENTER", section: "DISPLAY", action?: DisplayAction]
  | [type: "CONTROL_CENTER", section: "SOUND", action?: SoundAction];

export type TrayHandler = (...args: TrayAction) => Promise<void>;

export async function runTrayAction(...args: TrayAction): Promise<void> {
  const [type, value, action] = args;
  if ((type === "ITEM" || type === "HOVER") && !Number.isSafeInteger(value)) {
    throw new TypeError("tray index must be a safe integer");
  }
  return addon.runTrayAction(
    type,
    value === undefined ? "" : String(value),
    action ?? (type === "ITEM" ? "LEFT" : ""),
  );
}

/**
 * Builds the typed `@input:tray` handler. ITEM indexes count from the first menu-bar extra to the
 * right of the application menus; negative indexes count from the right edge. HOVER moves the
 * pointer to the indexed item without activating it. CONTROL_CENTER
 * opens the panel and optionally expands a section or operates one of its controls.
 * BATTERY and DATE_TIME activate their named menu-bar extras. WIFI opens its menu (or its
 * Control Center section when the icon is hidden); WIFI > TOGGLE switches Wi-Fi on/off.
 */
export default function buildHandler(): TrayHandler {
  return runTrayAction;
}
