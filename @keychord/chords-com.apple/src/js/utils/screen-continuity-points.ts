import type { ClickPoint, ScreenBounds } from "@keychord/chords-click/sequence";

/** Keep tap targets just inside Mirroring's display edges. */
export function clampDevicePoints(points: ClickPoint[], bounds: ScreenBounds): ClickPoint[] {
  const { x, y, width, height } = bounds;
  const inset = Math.min(2, width / 2, height / 2);
  return points.map((point) => ({
    ...point,
    x: x + Math.max(inset, Math.min(width - inset, point.x - x)),
    y: y + Math.max(inset, Math.min(height - inset, point.y - y)),
  }));
}
