import { click as clickWindow, getAppWindows, getScreenBounds, mouse } from "chord";
import {
  parseClickSequence,
  parseMouseCommand,
  resolveClickSequence,
  type ClickPoint,
  type ScreenBounds,
  type ClickKind,
} from "./utils/click-sequence";

export type ClickHandlerContext = { focusedAppId?: string };
export type ClickBounds = ScreenBounds & { windowId?: number };

// Leave time for UI transitions between coordinate actions.
const CLICK_SEQUENCE_DELAY_MS = 500;

/** Send resolved screen points to one window, with an optional check before each click. */
export async function clickPoints(
  bounds: ClickBounds,
  points: ClickPoint[],
  validate?: () => Promise<void>,
): Promise<void> {
  const { x, y, width, height, windowId } = bounds;
  let held: "left" | "right" | "middle" | undefined;
  let keepHeld = false;
  let usedMouse = false;
  try {
    for (const [index, point] of points.entries()) {
      await validate?.();
      const target =
        windowId === undefined
          ? { x: point.x, y: point.y }
          : {
              windowId,
              x: point.x - x,
              y: point.y - y,
              expectedBounds: { x, y, width, height },
            };
      const drag = point.click?.endsWith("DRAG");
      if (drag || point.click === "MOVE") {
        usedMouse = true;
        const button =
          point.click === "RIGHT_DRAG"
            ? "right"
            : point.click === "MIDDLE_DRAG"
              ? "middle"
              : "left";
        if (drag && held !== button) {
          await mouse({ ...target, action: "down", button });
          held = button;
        } else {
          await mouse({ ...target, action: "move" });
        }
      } else {
        if (usedMouse) {
          await mouse({ action: "up" });
          held = undefined;
        }
        const options = {
          ...target,
          moveCursor: true,
          ...(point.click === "RIGHT" || point.click === "MIDDLE"
            ? { button: point.click === "RIGHT" ? ("right" as const) : ("middle" as const) }
            : {}),
          ...(point.click === "DOUBLE" ? { clickCount: 2 as const } : {}),
          ...(point.click === "LONG" ? { pressDurationMs: 500 } : {}),
        };
        if (windowId === undefined) {
          const { moveCursor: _, ...globalOptions } = options;
          await mouse({ ...globalOptions, action: "click" });
        } else {
          await clickWindow({ ...options, windowId });
        }
      }
      keepHeld = !!point.hold;
      if (index < points.length - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, CLICK_SEQUENCE_DELAY_MS));
      }
    }
  } finally {
    if (usedMouse && !keepHeld) await mouse({ action: "up" });
  }
}

/** Click the captured app's frontmost on-screen window, or an explicitly named app. */
export default function buildClickHandler(bundleId?: string) {
  let pending = Promise.resolve();
  let holdingMouse = false;

  function enqueue(run: () => Promise<void>): Promise<void> {
    const action = pending.then(async () => {
      try {
        await run();
      } catch (error) {
        // Preflight failures never reach the native session's automatic release.
        if (holdingMouse) {
          await mouse({ action: "up" });
          holdingMouse = false;
        }
        throw error;
      }
    });
    // A failed sequence must not prevent the next chord from running.
    pending = action.catch(() => {});
    return action;
  }

  return function click(
    this: ClickHandlerContext | void,
    sequence: string,
    defaultClick: Exclude<ClickKind, "LONG"> | "COMMAND" = "LEFT",
  ): Promise<void> {
    // Capture the invocation context before waiting for a previous sequence to finish.
    const appId = bundleId ?? this?.focusedAppId;
    let positions: ReturnType<typeof parseClickSequence>;
    let global = false;
    try {
      if (defaultClick === "COMMAND") {
        ({ positions, global } = parseMouseCommand(sequence));
      } else if (
        ![
          "LEFT",
          "RIGHT",
          "MIDDLE",
          "DOUBLE",
          "DRAG",
          "RIGHT_DRAG",
          "MIDDLE_DRAG",
          "MOVE",
        ].includes(defaultClick)
      ) {
        throw new TypeError("Unknown default click type");
      } else positions = parseClickSequence(sequence, defaultClick);
      if (!global && !appId?.trim())
        throw new TypeError("A focused application or bundle ID is required");
    } catch (error) {
      return enqueue(async () => {
        throw error;
      });
    }

    return enqueue(async () => {
      let bounds: ClickBounds;
      if (global) bounds = getScreenBounds();
      else {
        const window = getAppWindows(appId!)[0];
        if (!window) throw new Error(`No on-screen window found for ${appId}`);
        bounds = { ...window.bounds, windowId: window.windowId };
      }
      const points = resolveClickSequence(positions, bounds);
      await clickPoints(bounds, points);
      holdingMouse = !!points.at(-1)?.hold;
    });
  };
}
