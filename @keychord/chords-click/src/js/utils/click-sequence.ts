export type ScreenBounds = { x: number; y: number; width: number; height: number };
export type ClickKind =
  | "LEFT"
  | "RIGHT"
  | "MIDDLE"
  | "DOUBLE"
  | "LONG"
  | "DRAG"
  | "RIGHT_DRAG"
  | "MIDDLE_DRAG"
  | "MOVE";
export type ClickPoint = { x: number; y: number; click?: ClickKind; hold?: boolean };

type Offset<Edge extends string> = { edge: Edge; value: number; fraction: boolean };
export type ClickPosition = {
  horizontal: Offset<"l" | "r">;
  vertical: Offset<"t" | "b">;
  click?: ClickKind;
  hold?: boolean;
};

/** Parse modifiers immediately after the initial dot; / inside a pair still refines it. */
export function parseMouseCommand(command: string): {
  positions: ClickPosition[];
  global: boolean;
} {
  let click: Exclude<ClickKind, "LONG"> = "LEFT";
  let global = false;
  let index = 0;
  const used = new Set<string>();
  while (index < command.length && ".,;=-/".includes(command[index])) {
    const marker = command[index];
    // Double-click's dash remains the established zero coordinate, not a drag modifier.
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
      ) {
        throw new TypeError("Choose the mouse button before the drag modifier");
      }
      click = marker === "." ? "DOUBLE" : marker === "," ? "RIGHT" : "MIDDLE";
    }
    index++;
    // A dash after a chosen drag modifier belongs to the coordinate pair (0%).
    if (marker === "-" && command[index] === "-") break;
  }
  return { positions: parseClickSequence(command.slice(index), click), global };
}

/** Parse x/y pairs completely before requesting any native clicks. */
export function parseClickSequence(
  sequence: string,
  defaultClick?: Exclude<ClickKind, "LONG">,
  radix: 10 | 36 = 10,
): ClickPosition[] {
  const input = sequence.trim();
  // Base-36 coordinates reserve bare l/r/t/b as digits. Pixel offsets need =.
  const token =
    radix === 36
      ? /\s*(?:=(\d+(?:\.\d+)?)([lrtb])|([0-9a-z])(?:\/([0-9a-z]))?)\s*/y
      : /\s*(?:(\d+(?:\.\d+)?)([lrtb])|([-0-9])(?:\/([0-9]))?)\s*/y;
  const positions: ClickPosition[] = [];
  let index = 0;
  let activeDrag: ClickKind | undefined;

  function coordinate() {
    token.lastIndex = index;
    const match = token.exec(input);
    if (!match) throw new TypeError(`Expected a click coordinate at character ${index + 1}`);
    index = token.lastIndex;
    const [, pixels, edge, digit, tenth] = match;
    const fraction = pixels === undefined;
    // Base 36 has 36 inclusive positions, 0–z; /n refines one step by n/36.
    // Decimal shorthand retains - = 0%, 0 = 100%, and /n adds n percent.
    const tenths = digit === "-" ? 0 : digit === "0" ? 10 : Number(digit);
    const value = fraction
      ? radix === 36
        ? (parseInt(digit, 36) + parseInt(tenth ?? "0", 36) / 36) / 35
        : (tenths * 10 + Number(tenth ?? 0)) / 100
      : Number(pixels);
    if (!Number.isFinite(value) || (!fraction && value > Number.MAX_SAFE_INTEGER)) {
      throw new TypeError(
        "Click offsets must be finite proportions or pixel amounts within the safe numeric range",
      );
    }
    return { edge, value, fraction };
  }

  while (index < input.length) {
    if (input[index] === "-" && index === input.length - 1 && positions.length) {
      const last = positions.at(-1)!;
      if (last.click === "DOUBLE") throw new TypeError("A double-click cannot be held");
      last.hold = true;
      if (last.click !== "MOVE" && !last.click?.endsWith("DRAG")) {
        last.click =
          last.click === "RIGHT" ? "RIGHT_DRAG" : last.click === "MIDDLE" ? "MIDDLE_DRAG" : "DRAG";
      }
      index++;
      break;
    }
    let click: ClickKind | undefined = activeDrag ?? defaultClick;
    if (input[index] === ",") {
      click = defaultClick === undefined ? "LONG" : "RIGHT";
      activeDrag = undefined;
      index++;
    } else if (defaultClick !== undefined && input[index] === ";") {
      click = "MIDDLE";
      activeDrag = undefined;
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
      } else if (defaultClick !== undefined && input[index] === ".") {
        click = "DOUBLE";
        index++;
      } else {
        click = defaultClick === undefined ? undefined : "LEFT";
      }
      if (click?.endsWith("DRAG")) activeDrag = click;
      else if (click !== "MOVE") activeDrag = undefined;
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
  clampEdges = true,
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
    return clampEdges && result === size ? size - 1 : result;
  }

  return positions.map(({ horizontal, vertical, click, hold }) => ({
    x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
    y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
    ...(click ? { click } : {}),
    ...(hold ? { hold } : {}),
  }));
}
