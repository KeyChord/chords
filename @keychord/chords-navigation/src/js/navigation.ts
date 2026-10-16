import addon from "./navigation.node";
import { click, getAppWindows, type WindowBounds } from "chord";

export type NavigationAction = "PREVIOUS" | "NEXT" | "CLOSE" | "OPTION";
export type NavigationContext = { focusedAppId?: string };

export default function buildNavigationHandler(bundleId?: string) {
  let pending: Promise<unknown> = Promise.resolve();
  return function navigation(
    this: NavigationContext | void,
    action: NavigationAction,
    index?: number | string,
  ): Promise<void> {
    const appId = bundleId ?? this?.focusedAppId;
    if (!appId?.trim()) return Promise.reject(new TypeError("A focused application is required"));
    if (!["PREVIOUS", "NEXT", "CLOSE", "OPTION"].includes(action))
      return Promise.reject(new TypeError(`Unknown navigation action: ${action}`));
    if (
      action === "OPTION" &&
      (!/^[1-9]\d*$/.test(String(index)) || !Number.isSafeInteger(Number(index)))
    )
      return Promise.reject(new TypeError("Option index must be a positive safe integer"));
    const request = JSON.stringify({
      action,
      ...(action === "OPTION" ? { index: Number(index) } : {}),
    });
    // Capture the app before waiting: subsequent invocations can target another app.
    const result = pending.then(async () => {
      const resolved = await addon.perform(appId, request);
      if (!resolved) return;
      const target = JSON.parse(resolved) as {
        processId: number;
        point: { x: number; y: number };
        bounds: WindowBounds;
      };
      const windows = getAppWindows(appId).filter(
        (window) =>
          window.processId === target.processId &&
          (Object.keys(target.bounds) as (keyof WindowBounds)[]).every(
            (key) => Math.abs(window.bounds[key] - target.bounds[key]) < 0.5,
          ),
      );
      if (windows.length !== 1)
        throw new Error("Navigation target window moved or is unavailable; retry the action");
      await click({
        windowId: windows[0].windowId,
        x: target.point.x - target.bounds.x,
        y: target.point.y - target.bounds.y,
        expectedBounds: windows[0].bounds,
      });
    });
    pending = result.catch(() => undefined);
    return result;
  };
}
