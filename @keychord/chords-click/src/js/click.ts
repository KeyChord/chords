import { click as clickWindow, getAppWindows } from "chord";
import {
  parseClickSequence,
  resolveClickSequence,
  type ClickPoint,
  type ScreenBounds,
} from "./utils/click-sequence";

export type ClickHandlerContext = { focusedAppId?: string };
export type ClickBounds = ScreenBounds & { windowId: number };

/** Send resolved screen points to one window, with an optional check before each click. */
export async function clickPoints(
  bounds: ClickBounds,
  points: ClickPoint[],
  validate?: () => Promise<void>,
): Promise<void> {
  const { x, y, width, height, windowId } = bounds;
  for (const [index, point] of points.entries()) {
    await validate?.();
    await clickWindow({
      windowId,
      x: point.x - x,
      y: point.y - y,
      expectedBounds: { x, y, width, height },
    });
    if (index < points.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    }
  }
}

/** Click the captured app's frontmost on-screen window, or an explicitly named app. */
export default function buildClickHandler(bundleId?: string) {
  let pending = Promise.resolve();

  return function click(this: ClickHandlerContext | void, sequence: string): Promise<void> {
    // Capture the invocation context before waiting for a previous sequence to finish.
    const appId = bundleId ?? this?.focusedAppId;
    let positions: ReturnType<typeof parseClickSequence>;
    try {
      positions = parseClickSequence(sequence);
      if (!appId?.trim()) throw new TypeError("A focused application or bundle ID is required");
    } catch (error) {
      return Promise.reject(error);
    }

    const action = pending.then(async () => {
      const window = getAppWindows(appId)[0];
      if (!window) throw new Error(`No on-screen window found for ${appId}`);
      const bounds = { ...window.bounds, windowId: window.windowId };
      const points = resolveClickSequence(positions, bounds);
      await clickPoints(bounds, points);
    });
    // A failed sequence must not prevent the next chord from running.
    pending = action.catch(() => {});
    return action;
  };
}
