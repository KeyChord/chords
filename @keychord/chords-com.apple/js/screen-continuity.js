import { click } from "chord";
//#region src/js/utils/click-sequence.ts
/** Parse the complete sequence before requesting any native clicks. */
function parseClickSequence(sequence) {
  const input = sequence.replace(/\s+/g, "");
  const token = /([tblr])(\.\d+|\d+(?:\.\d+)?)/y;
  const positions = [];
  let index = 0;
  while (index < input.length) {
    const position = {};
    for (let axis = 0; axis < 2; axis++) {
      token.lastIndex = index;
      const match = token.exec(input);
      if (!match) throw new TypeError(`Expected an edge and offset at character ${index + 1}`);
      index = token.lastIndex;
      const [, edge, amount] = match;
      const fraction = amount.startsWith(".");
      const value = Number(amount);
      if (!Number.isFinite(value) || (!fraction && value > Number.MAX_SAFE_INTEGER))
        throw new TypeError(
          "Click offsets must be finite fractions or pixel amounts within the safe numeric range",
        );
      if (edge === "l" || edge === "r") {
        if (position.horizontal) throw new TypeError("Each click needs one horizontal edge");
        position.horizontal = {
          edge,
          value,
          fraction,
        };
      } else {
        if (position.vertical) throw new TypeError("Each click needs one vertical edge");
        position.vertical = {
          edge,
          value,
          fraction,
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
    throw new TypeError("The mirrored iPhone screen has invalid bounds");
  function coordinate(offset, size, fromEnd) {
    const distance = offset.fraction ? offset.value * size : offset.value;
    if (!Number.isFinite(distance) || distance < 0 || distance > size)
      throw new RangeError("Click offset is outside the mirrored iPhone screen");
    const result = fromEnd ? size - distance : distance;
    return result === size ? size - 1 : result;
  }
  return positions.map(({ horizontal, vertical }) => ({
    x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
    y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
  }));
}
//#endregion
//#region src/js/utils/screen-continuity-native.ts
function openScreenContinuityAddon() {
  const module = { exports: {} };
  process.dlopen(module, import.meta.chord.resolveNative("screen-continuity"));
  const geometry = module.exports;
  return {
    getScreenBounds: () => geometry.getScreenBounds(),
    async clickPoints(request) {
      const { bounds, points } = JSON.parse(request);
      const { x, y, width, height } = bounds;
      for (const [index, point] of points.entries()) {
        await geometry.validateScreenBounds(JSON.stringify(bounds));
        await click({
          windowId: bounds.windowId,
          x: point.x - x,
          y: point.y - y,
          expectedBounds: {
            x,
            y,
            width,
            height,
          },
        });
        if (index < points.length - 1) await new Promise((resolve) => setTimeout(resolve, 200));
      }
    },
  };
}
//#endregion
//#region src/js/screen-continuity.ts
let addon;
function buildScreenContinuityHandler() {
  let pending = Promise.resolve();
  return function click(sequence) {
    let positions;
    try {
      positions = parseClickSequence(sequence);
    } catch (error) {
      return Promise.reject(error);
    }
    const action = pending.then(async () => {
      addon ??= openScreenContinuityAddon();
      const bounds = JSON.parse(await addon.getScreenBounds());
      const points = resolveClickSequence(positions, bounds);
      await addon.clickPoints(
        JSON.stringify({
          bounds,
          points,
        }),
      );
    });
    pending = action.catch(() => {});
    return action;
  };
}
//#endregion
export { buildScreenContinuityHandler as default };
