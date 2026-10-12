declare global {
  interface ImportMeta {
    /** Chord's per-module helpers, attached by the runtime to every module it loads. */
    chord: {
      /** Resolve a NodeSwift addon for Chord's current target triple. */
      resolveNative(outputRelpath: string): string;
      /** Resolve a file of this module's package, relative to the package root. */
      resolvePackageFile(relpath: string): string;
    };
  }
}

declare module "chord" {
  export type WindowBounds = { x: number; y: number; width: number; height: number };
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

export {};
