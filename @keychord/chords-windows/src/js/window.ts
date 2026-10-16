import addon from "./window.node";
import { parseWindowDimensions, type WindowAction } from "./utils/window-dimensions";

export type WindowHandlerAction = WindowAction | "CYCLE" | "SPACE";

type WindowHandlerThis = { focusedAppId?: string; focusedWindowId?: number | null; input?: string };

export default function buildWindowHandler() {
  let pending = Promise.resolve();
  return function window(
    this: WindowHandlerThis | void,
    action: WindowHandlerAction,
    expression: string,
  ): Promise<void> {
    let request: string;
    // Chord selects the window once per run, so every repetition of `3/ws]` or `3/wd=`
    // acts on it even after the first move shifts focus or the user switches windows.
    const windowId = this?.focusedWindowId ?? null;
    try {
      if (windowId !== null && (!Number.isSafeInteger(windowId) || windowId < 0))
        throw new TypeError("Expected a window number");
      if (action === "SPACE") {
        if (
          expression !== "NEXT" &&
          expression !== "PREVIOUS" &&
          (!/^[1-9]\d*$/.test(expression) || !Number.isSafeInteger(Number(expression)))
        )
          throw new TypeError("Expected a positive Space number, NEXT, or PREVIOUS");
        const appId = this?.focusedAppId;
        const result = pending.then(() => addon.moveWindowToSpace(appId, windowId, expression));
        pending = result.catch(() => {});
        return result;
      }
      if (action === "CYCLE") {
        if (expression !== "NEXT" && expression !== "PREVIOUS")
          throw new TypeError("Unknown window cycle direction");
        // Each repetition cycles on from the window the previous one focused.
        const appId = this?.focusedAppId;
        const result = pending.then(() => addon.cycleWindows(appId, expression));
        pending = result.catch(() => {});
        return result;
      }
      // Named axis chords intentionally pass the same action/capture pair. Chord's
      // entered input distinguishes width/height and X/Y after regex substitution.
      const axis = /^(?:\/)?(?:wd([wh])|wp([xy]))/.exec(this?.input ?? "");
      if (
        axis &&
        (action === "DIMENSIONS" ||
          action === "DIMENSIONS_INCREASE" ||
          action === "DIMENSIONS_DECREASE" ||
          action === "POSITION")
      ) {
        const { height: value } = parseWindowDimensions(action, `h${expression}`);
        request = JSON.stringify(
          axis[1] === "w" || axis[2] === "x" ? { width: value } : { height: value },
        );
      } else request = JSON.stringify(parseWindowDimensions(action, expression));
    } catch (error) {
      if (error instanceof TypeError) {
        error.message += ` (received ${JSON.stringify(this?.input ?? expression)})`;
      }
      return Promise.reject(error);
    }
    const appId = this?.focusedAppId;
    const result = pending.then(() => addon.runWindowAction(appId, windowId, action, request));
    pending = result.catch(() => {});
    return result;
  };
}
