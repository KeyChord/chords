export type ScreenBounds = { x: number; y: number; width: number; height: number };
export type ClickPoint = { x: number; y: number };

type Offset<Edge extends string> = { edge: Edge; value: number; fraction: boolean };
export type ClickPosition = {
  horizontal: Offset<"l" | "r">;
  vertical: Offset<"t" | "b">;
};

/** Parse the complete sequence before requesting any native clicks. */
export function parseClickSequence(sequence: string): ClickPosition[] {
  const input = sequence.replace(/\s+/g, "");
  const token = /([tblr])(\.\d+|\d+(?:\.\d+)?)/y;
  const positions: ClickPosition[] = [];
  let index = 0;

  while (index < input.length) {
    const position: Partial<ClickPosition> = {};
    for (let axis = 0; axis < 2; axis++) {
      token.lastIndex = index;
      const match = token.exec(input);
      if (!match) throw new TypeError(`Expected an edge and offset at character ${index + 1}`);
      index = token.lastIndex;
      const [, edge, amount] = match;
      const fraction = amount.startsWith(".");
      const value = Number(amount);
      if (!Number.isFinite(value) || (!fraction && value > Number.MAX_SAFE_INTEGER)) {
        throw new TypeError(
          "Click offsets must be finite fractions or pixel amounts within the safe numeric range",
        );
      }
      if (edge === "l" || edge === "r") {
        if (position.horizontal) throw new TypeError("Each click needs one horizontal edge");
        position.horizontal = { edge, value, fraction };
      } else {
        if (position.vertical) throw new TypeError("Each click needs one vertical edge");
        position.vertical = { edge: edge as "t" | "b", value, fraction };
      }
    }
    positions.push(position as ClickPosition);
  }

  if (!positions.length) throw new TypeError("Expected at least one click position");
  return positions;
}

/** AX and CGEvent both use global macOS screen points, including negative display origins. */
export function resolveClickSequence(
  positions: ClickPosition[],
  bounds: ScreenBounds,
): ClickPoint[] {
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.width < 1 ||
    bounds.height < 1
  ) {
    throw new TypeError("The mirrored iPhone screen has invalid bounds");
  }

  function coordinate(offset: Offset<string>, size: number, fromEnd: boolean): number {
    const distance = offset.fraction ? offset.value * size : offset.value;
    if (!Number.isFinite(distance) || distance < 0 || distance > size) {
      throw new RangeError("Click offset is outside the mirrored iPhone screen");
    }
    // A zero right/bottom offset must still land inside the window, not its neighbour.
    const result = fromEnd ? size - distance : distance;
    return result === size ? size - 1 : result;
  }

  return positions.map(({ horizontal, vertical }) => ({
    x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
    y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
  }));
}
