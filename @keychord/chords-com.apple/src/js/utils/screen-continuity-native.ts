import { click } from "chord";
import type { ClickPoint, ScreenBounds } from "./click-sequence";

export type ScreenContinuityAddon = {
  getScreenBounds(): Promise<string>;
  clickPoints(request: string): Promise<void>;
};

type ScreenContinuityGeometryAddon = {
  getScreenBounds(): Promise<string>;
  validateScreenBounds(bounds: string): Promise<void>;
};

export function openScreenContinuityAddon(): ScreenContinuityAddon {
  const module = { exports: {} as ScreenContinuityGeometryAddon };
  process.dlopen(module, import.meta.chord.resolveNative("screen-continuity"));
  const geometry = module.exports;
  return {
    getScreenBounds: () => geometry.getScreenBounds(),
    async clickPoints(request: string) {
      const { bounds, points } = JSON.parse(request) as {
        bounds: ScreenBounds & { windowId: number };
        points: ClickPoint[];
      };
      const { x, y, width, height } = bounds;
      for (const [index, point] of points.entries()) {
        await geometry.validateScreenBounds(JSON.stringify(bounds));
        await click({
          windowId: bounds.windowId,
          x: point.x - x,
          y: point.y - y,
          expectedBounds: { x, y, width, height },
        });
        if (index < points.length - 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 200));
        }
      }
    },
  };
}
