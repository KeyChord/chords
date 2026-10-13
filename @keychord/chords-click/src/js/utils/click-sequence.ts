export type ScreenBounds = { x: number; y: number; width: number; height: number };
export type ClickKind =
  | "left"
  | "right"
  | "middle"
  | "double"
  | "long"
  | "drag"
  | "right-drag"
  | "middle-drag"
  | "move";
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
  let click: Exclude<ClickKind, "long"> = "left";
  let global = false;
  let index = 0;
  const used = new Set<string>();
  while (index < command.length && ".,;=-/".includes(command[index])) {
    const marker = command[index];
    // Double-click's dash remains the established zero coordinate, not a drag modifier.
    if (marker === "-" && click === "double") break;
    if (marker === "-" && (used.has("-") || used.has("="))) break;
    if (used.has(marker)) throw new TypeError("Repeated mouse modifier");
    used.add(marker);
    if (marker === "/") global = true;
    else if (marker === "=") {
      if (used.has("-") || used.has(".") || used.has(",") || used.has(";"))
        throw new TypeError("A move cannot select a mouse button");
      click = "move";
    } else if (marker === "-") {
      if (click === "move") throw new TypeError("A move cannot start a drag");
      click = click === "middle" ? "middle-drag" : click === "right" ? "right-drag" : "drag";
    } else {
      if (
        [".", ",", ";"].some((button) => used.has(button) && button !== marker) ||
        used.has("=") ||
        used.has("-")
      ) {
        throw new TypeError("Choose the mouse button before the drag modifier");
      }
      click = marker === "." ? "double" : marker === "," ? "right" : "middle";
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
  defaultClick?: Exclude<ClickKind, "long">,
): ClickPosition[] {
  const input = sequence.trim();
  const token = /\s*(?:(\d+(?:\.\d+)?)([lrtb])|([-0-9])(?:\/([0-9]))?)\s*/y;
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
    // A shorthand unit is 10% of the window; /n adds n tenths of that unit.
    const tenths = digit === "-" ? 0 : digit === "0" ? 10 : Number(digit);
    const value = fraction ? (tenths * 10 + Number(tenth ?? 0)) / 100 : Number(pixels);
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
      if (last.click === "double") throw new TypeError("A double-click cannot be held");
      last.hold = true;
      if (last.click !== "move" && !last.click?.endsWith("drag")) {
        last.click =
          last.click === "right" ? "right-drag" : last.click === "middle" ? "middle-drag" : "drag";
      }
      index++;
      break;
    }
    let click: ClickKind | undefined = activeDrag ?? defaultClick;
    if (input[index] === ",") {
      click = defaultClick === undefined ? "long" : "right";
      activeDrag = undefined;
      index++;
    } else if (defaultClick !== undefined && input[index] === ";") {
      click = "middle";
      activeDrag = undefined;
      index++;
    } else if (input[index] === ".") {
      index++;
      if (input[index] === "=") {
        click = "move";
        index++;
      } else if (input[index] === "-") {
        click = "drag";
        index++;
      } else if (input[index] === ";" || input[index] === ",") {
        click = input[index++] === ";" ? "middle" : "right";
        if (input[index] === "-") {
          click = click === "middle" ? "middle-drag" : "right-drag";
          index++;
        }
      } else if (defaultClick !== undefined && input[index] === ".") {
        click = "double";
        index++;
      } else {
        click = defaultClick === undefined ? undefined : "left";
      }
      if (click?.endsWith("drag")) activeDrag = click;
      else if (click !== "move") activeDrag = undefined;
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

  return positions.map(({ horizontal, vertical, click, hold }) => ({
    x: bounds.x + coordinate(horizontal, bounds.width, horizontal.edge === "r"),
    y: bounds.y + coordinate(vertical, bounds.height, vertical.edge === "b"),
    ...(click ? { click } : {}),
    ...(hold ? { hold } : {}),
  }));
}
