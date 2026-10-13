export type WindowAction = "size" | "position" | "frame" | "preset";
export type WindowDimension = { value: number; unit: "divisor" | "fraction" | "pixels" };
export type WindowDimensions = {
  width?: WindowDimension;
  height?: WindowDimension;
  left?: WindowDimension;
  top?: WindowDimension;
  right?: boolean;
  preset?: string;
};

/** Signed single-digit shorthand: negative sizes add whole display extents. */
export function parseWindowDimensions(action: WindowAction, expression: string): WindowDimensions {
  if (action === "preset") {
    if (
      ![
        "left",
        "right",
        "top",
        "bottom",
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
        "horizontal",
        "vertical",
        "center",
        "fill",
      ].includes(expression)
    ) {
      throw new TypeError("Unknown window preset");
    }
    return { preset: expression };
  }
  if (action !== "size" && action !== "position" && action !== "frame")
    throw new TypeError("Unknown window action");
  if (typeof expression !== "string") throw new TypeError("Expected window dimensions");
  let input = expression.trim();
  const right = action === "position" && input.startsWith("r");
  if (right) input = input.slice(1);
  const heightOnly = action !== "frame" && input.startsWith("h");
  if (heightOnly) input = input.slice(1);
  if (right && heightOnly) throw new TypeError("Right-edge positioning needs a horizontal offset");

  const dimensions: WindowDimension[] = [];
  function dimension(token: string, unit: WindowDimension["unit"]): WindowDimension {
    const kind = action === "frame" ? (dimensions.length < 2 ? "size" : "position") : action;
    const value = Number(token);
    if (
      !Number.isFinite(value) ||
      Math.abs(value) > Number.MAX_SAFE_INTEGER ||
      (kind === "size" && (action === "frame" ? value < 0 : value <= 0)) ||
      (unit === "divisor" && (!value || !Number.isFinite(1 / value)))
    ) {
      throw new TypeError("Window dimensions must be finite; sizes must be positive");
    }
    return { value, unit };
  }

  if (input.includes("x")) {
    if (action === "frame")
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
      if (!match || dimensions.length === (action === "frame" ? 4 : 2))
        throw new TypeError("Unexpected window dimension count or syntax");
      index = token.lastIndex;
      const amount = Number(match[1]);
      const kind = action === "frame" ? (dimensions.length < 2 ? "size" : "position") : action;
      if (Object.is(amount, -0)) throw new TypeError("Negative zero is not a window dimension");
      const unit =
        (action === "frame" && amount === 0) ||
        (kind === "size" && amount < 0) ||
        (kind === "position" && amount === 0)
          ? "fraction"
          : "divisor";
      dimensions.push(dimension(String(kind === "size" && amount < 0 ? 1 - amount : amount), unit));
    }
  }
  if (action === "frame") {
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
