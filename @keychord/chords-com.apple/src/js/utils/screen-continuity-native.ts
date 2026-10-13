import { clickPoints, type ClickBounds } from "@keychord/chords-click";
import type { ClickPoint } from "./click-sequence";

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
        bounds: ClickBounds;
        points: ClickPoint[];
      };
      await clickPoints(bounds, points, () =>
        geometry.validateScreenBounds(JSON.stringify(bounds)),
      );
    },
  };
}
