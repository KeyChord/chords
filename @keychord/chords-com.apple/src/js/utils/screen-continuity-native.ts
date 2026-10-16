import { clickPoints, type ClickBounds } from "@keychord/chords-click";
import { mouse } from "chord";
import type { ClickPoint, ScreenBounds } from "@keychord/chords-click/sequence";
import geometry from "./screenContinuity.node";
import { clampDevicePoints } from "./screen-continuity-points";

export type ScreenContinuityAddon = {
  getScreenBounds(): Promise<string>;
  clickPoints(request: string): Promise<void>;
};

export function openScreenContinuityAddon(): ScreenContinuityAddon {
  return {
    getScreenBounds: () => geometry.getScreenBounds(),
    async clickPoints(request: string) {
      const { bounds, points, hover } = JSON.parse(request) as {
        bounds: ClickBounds & { windowBounds: ScreenBounds };
        points: ClickPoint[];
        hover?: boolean;
      };
      // Hover must not continue a button held by an earlier tap/drag sequence.
      if (hover) await mouse({ action: "up" });
      // Points use the device rectangle; native routing and movement checks use
      // the containing window, including its toolbar and bezel.
      await clickPoints(
        { ...bounds.windowBounds, windowId: bounds.windowId },
        hover
          ? points.map(({ x, y }) => ({ x, y, click: "MOVE" as const }))
          : clampDevicePoints(points, bounds),
        () => geometry.validateScreenBounds(JSON.stringify(bounds)),
      );
    },
  };
}
