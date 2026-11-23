export interface Point {
  x: number;
  y: number;
}

export interface Frame extends Point {
  width: number;
  height: number;
}

export interface Display extends Frame {
  primary: boolean;
  workArea?: Frame;
}

export function center({ x, y, width, height }: Frame): Point {
  return { x: x + Math.floor(width / 2), y: y + Math.floor(height / 2) };
}

function contains(frame: Frame, point: Point): boolean {
  return (
    point.x >= frame.x &&
    point.x < frame.x + frame.width &&
    point.y >= frame.y &&
    point.y < frame.y + frame.height
  );
}

function distance(frame: Frame, point: Point): number {
  return Math.hypot(frame.x + frame.width / 2 - point.x, frame.y + frame.height / 2 - point.y);
}

export function targetDisplay<T extends Display>(displays: T[], target: string, pointer: Point): T {
  const ordered = displays.toSorted((a, b) => Number(b.primary) - Number(a.primary));
  if (!ordered.length) throw new Error("No monitor is available");

  if (/^\d/.test(target)) {
    const display = ordered[Number(target) - 1];
    if (!display) throw new Error(`Monitor ${target} does not exist (${ordered.length} connected)`);
    return display;
  }

  const current =
    ordered.find((display) => contains(display, pointer)) ??
    ordered.toSorted((a, b) => distance(a, pointer) - distance(b, pointer))[0];
  const index = ordered.indexOf(current);
  if (target === "NEXT") return ordered[(index + 1) % ordered.length];
  if (target === "PREVIOUS") return ordered[(index + ordered.length - 1) % ordered.length];

  const origin = center(current);
  const candidates = ordered.filter((display) => {
    if (display === current) return false;
    const point = center(display);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    if (target === "LEFT") return dx < 0 && -dx >= Math.abs(dy);
    if (target === "RIGHT") return dx > 0 && dx >= Math.abs(dy);
    if (target === "UP") return dy < 0 && -dy >= Math.abs(dx);
    return dy > 0 && dy >= Math.abs(dx);
  });
  const display = candidates.sort((a, b) => distance(a, origin) - distance(b, origin))[0];
  if (!display) throw new Error(`No monitor to the ${target}`);
  return display;
}

/** Assign a spanning window to the display that contains the largest part of it. */
export function displayOfWindow<T extends Display>(displays: T[], window: Frame): T | undefined {
  let largest = 0;
  let selected: T | undefined;
  for (const display of displays) {
    const width =
      Math.min(display.x + display.width, window.x + window.width) - Math.max(display.x, window.x);
    const height =
      Math.min(display.y + display.height, window.y + window.height) -
      Math.max(display.y, window.y);
    if (width > 0 && height > 0 && width * height > largest) {
      selected = display;
      largest = width * height;
    }
  }
  return selected;
}
