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
  export function getScreenBounds(): { x: number; y: number; width: number; height: number };
  export function mouse(options: {
    action: "click" | "down" | "move" | "up";
    windowId?: number;
    x?: number;
    y?: number;
    expectedBounds?: { x: number; y: number; width: number; height: number };
    button?: "left" | "right" | "middle";
    clickCount?: 1 | 2;
    pressDurationMs?: number;
  }): Promise<void>;
  export type WindowBounds = { x: number; y: number; width: number; height: number };
  export function getAppWindows(bundleId: string): {
    windowId: number;
    processId: number;
    bounds: WindowBounds;
    title: string | null;
  }[];
  /** Click in window-local top-left macOS points without activating the target. */
  export function click(options: {
    windowId: number;
    x: number;
    y: number;
    expectedBounds?: WindowBounds;
    /** Move the cursor to the target point; clicks still go directly to the window. */
    moveCursor?: boolean;
    button?: "left" | "right" | "middle";
    clickCount?: 1 | 2;
    pressDurationMs?: number;
  }): Promise<void>;
}

export {};
