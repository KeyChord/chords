import { click, getAppWindows, getScreenBounds, mouse } from "chord";
//#region src/js/utils/click-sequence.ts
/** Parse modifiers immediately after the initial dot; / inside a pair still refines it. */
function parseMouseCommand(command) {
  let click = "LEFT";
  let global = false;
  let index = 0;
  const used = /* @__PURE__ */ new Set();
  while (index < command.length && ".,;=-/".includes(command[index])) {
    const marker = command[index];
    if (marker === "-" && click === "DOUBLE") break;
    if (marker === "-" && (used.has("-") || used.has("="))) break;
    if (used.has(marker)) throw new TypeError("Repeated mouse modifier");
    used.add(marker);
    if (marker === "/") global = true;
    else if (marker === "=") {
      if (used.has("-") || used.has(".") || used.has(",") || used.has(";"))
        throw new TypeError("A move cannot select a mouse button");
      click = "MOVE";
    } else if (marker === "-") {
      if (click === "MOVE") throw new TypeError("A move cannot start a drag");
      click = click === "MIDDLE" ? "MIDDLE_DRAG" : click === "RIGHT" ? "RIGHT_DRAG" : "DRAG";
    } else {
      if (
        [".", ",", ";"].some((button) => used.has(button) && button !== marker) ||
        used.has("=") ||
        used.has("-")
      )
        throw new TypeError("Choose the mouse button before the drag modifier");
      click = marker === "." ? "DOUBLE" : marker === "," ? "RIGHT" : "MIDDLE";
    }
    index++;
    if (marker === "-" && command[index] === "-") break;
  }
  return {
    positions: parseClickSequence(command.slice(index), click),
    global,
  };
}
/** Parse x/y pairs completely before requesting any native clicks. */
function parseClickSequence(sequence, defaultClick, radix = 10) {
  const input = sequence.trim();
  const token =
    radix === 36
      ? /\s*(?:=(\d+(?:\.\d+)?)([lrtb])|([0-9a-z])(?:\/([0-9a-z]))?)\s*/y
      : /\s*(?:(\d+(?:\.\d+)?)([lrtb])|([-0-9])(?:\/([0-9]))?)\s*/y;
  const positions = [];
  let index = 0;
  let activeDrag;
  function coordinate() {
    token.lastIndex = index;
    const match = token.exec(input);
    if (!match) throw new TypeError(`Expected a click coordinate at character ${index + 1}`);
    index = token.lastIndex;
    const [, pixels, edge, digit, tenth] = match;
    const fraction = pixels === void 0;
    const tenths = digit === "-" ? 0 : digit === "0" ? 10 : Number(digit);
    const value = fraction
      ? radix === 36
        ? (parseInt(digit, 36) + parseInt(tenth ?? "0", 36) / 36) / 35
        : (tenths * 10 + Number(tenth ?? 0)) / 100
      : Number(pixels);
    if (!Number.isFinite(value) || (!fraction && value > Number.MAX_SAFE_INTEGER))
      throw new TypeError(
        "Click offsets must be finite proportions or pixel amounts within the safe numeric range",
      );
    return {
      edge,
      value,
      fraction,
    };
  }
  while (index < input.length) {
    if (input[index] === "-" && index === input.length - 1 && positions.length) {
      const last = positions.at(-1);
      if (last.click === "DOUBLE") throw new TypeError("A double-click cannot be held");
      last.hold = true;
      if (last.click !== "MOVE" && !last.click?.endsWith("DRAG"))
        last.click =
          last.click === "RIGHT" ? "RIGHT_DRAG" : last.click === "MIDDLE" ? "MIDDLE_DRAG" : "DRAG";
      index++;
      break;
    }
    let click = activeDrag ?? defaultClick;
    if (input[index] === ",") {
      click = defaultClick === void 0 ? "LONG" : "RIGHT";
      activeDrag = void 0;
      index++;
    } else if (defaultClick !== void 0 && input[index] === ";") {
      click = "MIDDLE";
      activeDrag = void 0;
      index++;
    } else if (input[index] === ".") {
      index++;
      if (input[index] === "=") {
        click = "MOVE";
        index++;
      } else if (input[index] === "-") {
        click = "DRAG";
        index++;
      } else if (input[index] === ";" || input[index] === ",") {
        click = input[index++] === ";" ? "MIDDLE" : "RIGHT";
        if (input[index] === "-") {
          click = click === "MIDDLE" ? "MIDDLE_DRAG" : "RIGHT_DRAG";
          index++;
        }
      } else if (defaultClick !== void 0 && input[index] === ".") {
        click = "DOUBLE";
        index++;
      } else click = defaultClick === void 0 ? void 0 : "LEFT";
      if (click?.endsWith("DRAG")) activeDrag = click;
      else if (click !== "MOVE") activeDrag = void 0;
    }
    const position = click ? { click } : {};
    for (let axis = 0; axis < 2; axis++) {
      const amount = coordinate();
      const edge = amount.edge ?? (position.horizontal ? "t" : "l");
      if (edge === "l" || edge === "r") {
        if (position.horizontal) throw new TypeError("Each click needs one horizontal coordinate");
        position.horizontal = {
          ...amount,
          edge,
        };
      } else {
        if (position.vertical) throw new TypeError("Each click needs one vertical coordinate");
        position.vertical = {
          ...amount,
          edge,
        };
      }
    }
    positions.push(position);
  }
  if (!positions.length) throw new TypeError("Expected at least one click position");
  return positions;
}
/** AX and CGEvent both use global macOS screen points, including negative display origins. */
function resolveClickSequence(positions, bounds, clampEdges = true) {
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.width < 1 ||
    bounds.height < 1
  )
    throw new TypeError("The target window has invalid bounds");
  function coordinate(offset, size, fromEnd) {
    const distance = offset.fraction ? offset.value * size : offset.value;
    if (!Number.isFinite(distance) || distance < 0 || distance > size)
      throw new RangeError("Click offset is outside the target window");
    const result = fromEnd ? size - distance : distance;
    return clampEdges && result === size ? size - 1 : result;
  }
  return positions.map(({ horizontal, vertical, click, hold }) => ({
    x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
    y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
    ...(click ? { click } : {}),
    ...(hold ? { hold } : {}),
  }));
}
//#endregion
//#region src/js/click.ts
const CLICK_SEQUENCE_DELAY_MS = 500;
/** Send resolved screen points to one window, with an optional check before each click. */
async function clickPoints(bounds, points, validate) {
  const { x, y, width, height, windowId } = bounds;
  let held;
  let keepHeld = false;
  let usedMouse = false;
  try {
    for (const [index, point] of points.entries()) {
      await validate?.();
      const target =
        windowId === void 0
          ? {
              x: point.x,
              y: point.y,
            }
          : {
              windowId,
              x: point.x - x,
              y: point.y - y,
              expectedBounds: {
                x,
                y,
                width,
                height,
              },
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
          await mouse({
            ...target,
            action: "down",
            button,
          });
          held = button;
        } else
          await mouse({
            ...target,
            action: "move",
          });
      } else {
        if (usedMouse) {
          await mouse({ action: "up" });
          held = void 0;
        }
        const options = {
          ...target,
          moveCursor: true,
          ...(point.click === "RIGHT" || point.click === "MIDDLE"
            ? { button: point.click === "RIGHT" ? "right" : "middle" }
            : {}),
          ...(point.click === "DOUBLE" ? { clickCount: 2 } : {}),
          ...(point.click === "LONG" ? { pressDurationMs: 500 } : {}),
        };
        if (windowId === void 0) {
          const { moveCursor: _, ...globalOptions } = options;
          await mouse({
            ...globalOptions,
            action: "click",
          });
        } else
          await click({
            ...options,
            windowId,
          });
      }
      keepHeld = !!point.hold;
      if (index < points.length - 1)
        await new Promise((resolve) => setTimeout(resolve, CLICK_SEQUENCE_DELAY_MS));
    }
  } finally {
    if (usedMouse && !keepHeld) await mouse({ action: "up" });
  }
}
/** Click the captured app's frontmost on-screen window, or an explicitly named app. */
function buildClickHandler(bundleId) {
  let pending = Promise.resolve();
  let holdingMouse = false;
  function enqueue(run) {
    const action = pending.then(async () => {
      try {
        await run();
      } catch (error) {
        if (holdingMouse) {
          await mouse({ action: "up" });
          holdingMouse = false;
        }
        throw error;
      }
    });
    pending = action.catch(() => {});
    return action;
  }
  return function click(sequence, defaultClick = "LEFT") {
    const appId = bundleId ?? this?.focusedAppId;
    let positions;
    let global = false;
    try {
      if (defaultClick === "COMMAND") ({ positions, global } = parseMouseCommand(sequence));
      else if (
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
      )
        throw new TypeError("Unknown default click type");
      else positions = parseClickSequence(sequence, defaultClick);
      if (!global && !appId?.trim())
        throw new TypeError("A focused application or bundle ID is required");
    } catch (error) {
      return enqueue(async () => {
        throw error;
      });
    }
    return enqueue(async () => {
      let bounds;
      if (global) bounds = getScreenBounds();
      else {
        const window = getAppWindows(appId)[0];
        if (!window) throw new Error(`No on-screen window found for ${appId}`);
        bounds = {
          ...window.bounds,
          windowId: window.windowId,
        };
      }
      const points = resolveClickSequence(positions, bounds);
      await clickPoints(bounds, points);
      holdingMouse = !!points.at(-1)?.hold;
    });
  };
}
//#endregion
export { clickPoints, buildClickHandler as default };
