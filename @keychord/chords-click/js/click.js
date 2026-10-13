import { click, getAppWindows } from "chord";
//#region src/js/utils/click-sequence.ts
/** Parse x/y pairs completely before requesting any native clicks. */
function parseClickSequence(sequence, defaultClick) {
  const input = sequence.trim();
  const token = /\s*(?:(\d+(?:\.\d+)?)([lrtb])|([-0-9]))\s*/y;
  const positions = [];
  let index = 0;
  function coordinate() {
    token.lastIndex = index;
    const match = token.exec(input);
    if (!match) throw new TypeError(`Expected a click coordinate at character ${index + 1}`);
    index = token.lastIndex;
    const [, pixels, edge, digit] = match;
    const fraction = pixels === void 0;
    const value = fraction
      ? digit === "-"
        ? 0
        : digit === "0"
          ? 1
          : Number(digit) / 10
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
    if (positions.length && input[index] === "/") index++;
    let click = defaultClick;
    if (input[index] === ",") {
      click = defaultClick === void 0 ? "long" : "right";
      index++;
    } else if (defaultClick !== void 0 && input[index] === ";") {
      click = "middle";
      index++;
    } else if (input[index] === ".") {
      click = defaultClick === void 0 ? void 0 : input[index + 1] === "." ? "double" : "left";
      index += click === "double" ? 2 : 1;
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
function resolveClickSequence(positions, bounds) {
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
    return result === size ? size - 1 : result;
  }
  return positions.map(({ horizontal, vertical, click }) => ({
    x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
    y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
    ...(click ? { click } : {}),
  }));
}
//#endregion
//#region src/js/click.ts
const CLICK_SEQUENCE_DELAY_MS = 500;
/** Send resolved screen points to one window, with an optional check before each click. */
async function clickPoints(bounds, points, validate) {
  const { x, y, width, height, windowId } = bounds;
  for (const [index, point] of points.entries()) {
    await validate?.();
    await click({
      windowId,
      x: point.x - x,
      y: point.y - y,
      expectedBounds: {
        x,
        y,
        width,
        height,
      },
      ...(point.click === "right" || point.click === "middle" ? { button: point.click } : {}),
      ...(point.click === "double" ? { clickCount: 2 } : {}),
      ...(point.click === "long" ? { pressDurationMs: 500 } : {}),
    });
    if (index < points.length - 1)
      await new Promise((resolve) => setTimeout(resolve, CLICK_SEQUENCE_DELAY_MS));
  }
}
/** Click the captured app's frontmost on-screen window, or an explicitly named app. */
function buildClickHandler(bundleId) {
  let pending = Promise.resolve();
  return function click(sequence, defaultClick = "left") {
    const appId = bundleId ?? this?.focusedAppId;
    let positions;
    try {
      if (!["left", "right", "middle", "double"].includes(defaultClick))
        throw new TypeError("Unknown default click type");
      positions = parseClickSequence(sequence, defaultClick);
      if (!appId?.trim()) throw new TypeError("A focused application or bundle ID is required");
    } catch (error) {
      return Promise.reject(error);
    }
    const action = pending.then(async () => {
      const window = getAppWindows(appId)[0];
      if (!window) throw new Error(`No on-screen window found for ${appId}`);
      const bounds = {
        ...window.bounds,
        windowId: window.windowId,
      };
      await clickPoints(bounds, resolveClickSequence(positions, bounds));
    });
    pending = action.catch(() => {});
    return action;
  };
}
//#endregion
export { clickPoints, buildClickHandler as default };
