declare module "chord" {
  export type WindowBounds = { x: number; y: number; width: number; height: number };
  /** The display containing the pointer, in global macOS logical points. */
  export function getScreenBounds(): WindowBounds;
  /** Omit windowId for ordinary global input. Up releases even a vanished window. */
  export function mouse(options: {
    action: "click" | "down" | "move" | "up";
    windowId?: number;
    x?: number;
    y?: number;
    expectedBounds?: WindowBounds;
    button?: "left" | "right" | "middle";
    clickCount?: 1 | 2;
    pressDurationMs?: number;
  }): Promise<void>;
  /** On-screen normal windows in front-to-back order. */
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
