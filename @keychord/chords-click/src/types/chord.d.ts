declare module "chord" {
  export type WindowBounds = { x: number; y: number; width: number; height: number };
  /** On-screen normal windows in front-to-back order. */
  export function getAppWindows(bundleId: string): {
    windowId: number;
    processId: number;
    bounds: WindowBounds;
    title: string | null;
  }[];
  /** Left click in window-local top-left macOS points, without moving the cursor or activating. */
  export function click(options: {
    windowId: number;
    x: number;
    y: number;
    expectedBounds?: WindowBounds;
  }): Promise<void>;
}
