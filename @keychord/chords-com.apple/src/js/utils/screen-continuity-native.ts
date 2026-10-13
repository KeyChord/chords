import { clickPoints, type ClickBounds } from "@keychord/chords-click";
import type { ClickPoint } from "@keychord/chords-click/sequence";
import geometry from "./screenContinuity.node";

export type ScreenContinuityAddon = {
  getScreenBounds(): Promise<string>;
  clickPoints(request: string): Promise<void>;
};

export function openScreenContinuityAddon(): ScreenContinuityAddon {
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
