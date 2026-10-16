export type WindowAction =
  | "DIMENSIONS"
  | "DIMENSIONS_INCREASE"
  | "DIMENSIONS_DECREASE"
  | "POSITION"
  | "FRAME"
  | "PRESET";
export type WindowDimension = { value: number; unit: "divisor" | "fraction" | "pixels" };
export type WindowDimensions = {
  width?: WindowDimension;
  height?: WindowDimension;
  left?: WindowDimension;
  top?: WindowDimension;
  right?: boolean;
  preset?: string;
};

/** Absolute shorthand uses display extents; relative actions scale current dimensions. */
export function parseWindowDimensions(action: WindowAction, expression: string): WindowDimensions {
  if (action === "DIMENSIONS_INCREASE" || action === "DIMENSIONS_DECREASE") {
    if (typeof expression !== "string") throw new TypeError("Expected relative window dimensions");
    const match = /^(h)?([0-9]?)$/.exec(expression.trim());
    if (!match)
      throw new TypeError("Expected one dimension adjustment digit: 1–9 for 10–90%, 0 for 100%");
    const amount = match[2] === "" ? 1 : match[2] === "0" ? 10 : Number(match[2]);
    const value = (action === "DIMENSIONS_INCREASE" ? 10 + amount : 10 - amount) / 10;
    if (value <= 0) throw new TypeError("A 100% decrease would produce a zero window dimension");
    const scale: WindowDimension = { value, unit: "fraction" };
    return match[1] ? { height: scale } : { width: scale, height: scale };
  }
  if (action === "PRESET") {
    if (
      ![
        "LEFT",
        "RIGHT",
        "TOP",
        "BOTTOM",
        "TOP_LEFT",
        "TOP_RIGHT",
        "BOTTOM_LEFT",
        "BOTTOM_RIGHT",
        "HORIZONTAL",
        "VERTICAL",
        "CENTER",
        "FILL",
      ].includes(expression)
    ) {
      throw new TypeError("Unknown window preset");
    }
    return { preset: expression };
  }
  if (action !== "DIMENSIONS" && action !== "POSITION" && action !== "FRAME")
    throw new TypeError("Unknown window action");
  if (typeof expression !== "string") throw new TypeError("Expected window dimensions");
  let input = expression.trim();
  const right = action === "POSITION" && input.startsWith("r");
  if (right) input = input.slice(1);
  const heightOnly = action !== "FRAME" && input.startsWith("h");
  if (heightOnly) input = input.slice(1);
  if (right && heightOnly) throw new TypeError("Right-edge positioning needs a horizontal offset");

  const dimensions: WindowDimension[] = [];
  function dimension(token: string, unit: WindowDimension["unit"]): WindowDimension {
    const kind = action === "FRAME" ? (dimensions.length < 2 ? "DIMENSIONS" : "POSITION") : action;
    const value = Number(token);
    if (
      !Number.isFinite(value) ||
      Math.abs(value) > Number.MAX_SAFE_INTEGER ||
      (kind === "DIMENSIONS" && (action === "FRAME" ? value < 0 : value <= 0)) ||
      (unit === "divisor" && (!value || !Number.isFinite(1 / value)))
    ) {
      throw new TypeError("Window dimensions must be finite; width and height must be positive");
    }
    return { value, unit };
  }

  if (input.includes("x")) {
    if (action === "FRAME")
      throw new TypeError("Combined window bounds use four shorthand dimensions");
    // An x after the first number selects pixels for both dimensions.
    const absolute = /^(-?(?:\d+(?:\.\d+)?|\.\d+))x(?:(-?(?:\d+(?:\.\d+)?|\.\d+))x?)?$/.exec(input);
    if (!absolute) throw new TypeError("Expected pixel dimensions such as 200x or 200x200");
    dimensions.push(dimension(absolute[1], "pixels"));
    if (absolute[2] !== undefined) dimensions.push(dimension(absolute[2], "pixels"));
  } else {
    const token = /\s*(-?[0-9])\s*/y;
    let index = 0;
    while (index < input.length) {
      token.lastIndex = index;
      const match = token.exec(input);
      if (!match || dimensions.length === (action === "FRAME" ? 4 : 2))
        throw new TypeError("Unexpected window dimension count or syntax");
      index = token.lastIndex;
      const amount = Number(match[1]);
      const kind =
        action === "FRAME" ? (dimensions.length < 2 ? "DIMENSIONS" : "POSITION") : action;
      if (Object.is(amount, -0)) throw new TypeError("Negative zero is not a window dimension");
      const unit =
        (action === "FRAME" && amount === 0) ||
        (kind === "DIMENSIONS" && amount < 0) ||
        (kind === "POSITION" && amount === 0)
          ? "fraction"
          : "divisor";
      dimensions.push(
        dimension(String(kind === "DIMENSIONS" && amount < 0 ? 1 - amount : amount), unit),
      );
    }
  }
  if (action === "FRAME") {
    if (dimensions.length !== 4) throw new TypeError("Expected width, height, left, and top");
    return {
      ...(dimensions[0].value === 0 ? {} : { width: dimensions[0] }),
      ...(dimensions[1].value === 0 ? {} : { height: dimensions[1] }),
      left: dimensions[2],
      top: dimensions[3],
    };
  }
  if (!dimensions.length || (heightOnly && dimensions.length !== 1)) {
    throw new TypeError("Expected a dimension; h accepts only a height");
  }
  return {
    ...(heightOnly
      ? { height: dimensions[0] }
      : { width: dimensions[0], ...(dimensions[1] ? { height: dimensions[1] } : {}) }),
    ...(right ? { right: true } : {}),
  };
}
