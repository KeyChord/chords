export type ScreenBounds = { x: number; y: number; width: number; height: number };
export type ClickKind = "left" | "right" | "middle" | "double" | "long";
export type ClickPoint = { x: number; y: number; click?: ClickKind };

type Offset<Edge extends string> = { edge: Edge; value: number; fraction: boolean };
export type ClickPosition = {
  horizontal: Offset<"l" | "r">;
  vertical: Offset<"t" | "b">;
  click?: ClickKind;
};

/** Parse x/y pairs completely before requesting any native clicks. */
export function parseClickSequence(
  sequence: string,
  defaultClick?: Exclude<ClickKind, "long">,
): ClickPosition[] {
  const input = sequence.trim();
  const token = /\s*(?:(\d+(?:\.\d+)?)([lrtb])|([-0-9]))\s*/y;
  const positions: ClickPosition[] = [];
  let index = 0;

  function coordinate() {
    token.lastIndex = index;
    const match = token.exec(input);
    if (!match) throw new TypeError(`Expected a click coordinate at character ${index + 1}`);
    index = token.lastIndex;
    const [, pixels, edge, digit] = match;
    const fraction = pixels === undefined;
    const value = fraction
      ? digit === "-"
        ? 0
        : digit === "0"
          ? 1
          : Number(digit) / 10
      : Number(pixels);
    if (!Number.isFinite(value) || (!fraction && value > Number.MAX_SAFE_INTEGER)) {
      throw new TypeError(
        "Click offsets must be finite proportions or pixel amounts within the safe numeric range",
      );
    }
    return { edge, value, fraction };
  }

  while (index < input.length) {
    if (positions.length && input[index] === "/") index++;
    let click: ClickKind | undefined = defaultClick;
    if (input[index] === ",") {
      click = defaultClick === undefined ? "long" : "right";
      index++;
    } else if (defaultClick !== undefined && input[index] === ";") {
      click = "middle";
      index++;
    } else if (input[index] === ".") {
      click = defaultClick === undefined ? undefined : input[index + 1] === "." ? "double" : "left";
      index += click === "double" ? 2 : 1;
    }
    const position: Partial<ClickPosition> = click ? { click } : {};
    for (let axis = 0; axis < 2; axis++) {
      const amount = coordinate();
      const edge = amount.edge ?? (position.horizontal ? "t" : "l");
      if (edge === "l" || edge === "r") {
        if (position.horizontal) throw new TypeError("Each click needs one horizontal coordinate");
        position.horizontal = { ...amount, edge };
      } else {
        if (position.vertical) throw new TypeError("Each click needs one vertical coordinate");
        position.vertical = { ...amount, edge: edge as "t" | "b" };
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
    throw new TypeError("The target window has invalid bounds");
  }

  function coordinate(offset: Offset<string>, size: number, fromEnd: boolean): number {
    const distance = offset.fraction ? offset.value * size : offset.value;
    if (!Number.isFinite(distance) || distance < 0 || distance > size) {
      throw new RangeError("Click offset is outside the target window");
    }
    // A zero right/bottom offset must still land inside the window, not its neighbour.
    const result = fromEnd ? size - distance : distance;
    return result === size ? size - 1 : result;
  }

  return positions.map(({ horizontal, vertical, click }) => ({
    x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
    y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
    ...(click ? { click } : {}),
  }));
}
