import addon from "./window.node";
import { parseWindowDimensions, type WindowAction } from "./utils/window-dimensions";

export default function buildWindowHandler() {
  let pending = Promise.resolve();
  return function window(
    this: { focusedAppId?: string; input?: string } | void,
    action: WindowAction,
    expression: string,
  ): Promise<void> {
    let request: string;
    try {
      // Named axis chords intentionally pass the same action/capture pair. Chord's
      // entered input distinguishes width/height and X/Y after regex substitution.
      const axis = /^(?:\/)?(?:ws([wh])|wp([xy]))/.exec(this?.input ?? "");
      if (axis && (action === "size" || action === "position")) {
        const { height: value } = parseWindowDimensions(action, `h${expression}`);
        request = JSON.stringify(
          axis[1] === "w" || axis[2] === "x" ? { width: value } : { height: value },
        );
      } else request = JSON.stringify(parseWindowDimensions(action, expression));
    } catch (error) {
      return Promise.reject(error);
    }
    const appId = this?.focusedAppId;
    const result = pending.then(() => addon.runWindowAction(appId, action, request));
    pending = result.catch(() => {});
    return result;
  };
}
