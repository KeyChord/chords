declare module "chord" {
  export type WindowBounds = { x: number; y: number; width: number; height: number };
  export function getAppWindows(
    bundleId: string,
  ): { windowId: number; processId: number; bounds: WindowBounds }[];
  export function click(options: {
    windowId: number;
    x: number;
    y: number;
    expectedBounds: WindowBounds;
  }): Promise<void>;
}
