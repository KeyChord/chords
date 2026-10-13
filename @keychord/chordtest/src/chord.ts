/** The built-in `chord` module preloaded by the unit-test runtime. */
import { vi } from "vite-plus/test";

function unconfigured(name: string): never {
  throw new Error(`chord.${name} is not configured in this test; mock the preloaded chord export`);
}

export type WindowBounds = { x: number; y: number; width: number; height: number };
export type NativeWindow = {
  windowId: number;
  processId: number;
  bounds: WindowBounds;
  title: string | null;
};

export const getScreenBounds = vi.fn((): WindowBounds => unconfigured("getScreenBounds"));
export const mouse = vi.fn(
  async (_options: {
    action: "click" | "down" | "move" | "up";
    windowId?: number;
    x?: number;
    y?: number;
    expectedBounds?: WindowBounds;
    button?: "left" | "right" | "middle";
    clickCount?: 1 | 2;
    pressDurationMs?: number;
  }): Promise<void> => unconfigured("mouse"),
);

export const click = vi.fn(
  async (_options: {
    windowId: number;
    x: number;
    y: number;
    expectedBounds?: WindowBounds;
    moveCursor?: boolean;
    button?: "left" | "right" | "middle";
    clickCount?: 1 | 2;
    pressDurationMs?: number;
  }): Promise<void> => unconfigured("click"),
);
export const getAppWindows = vi.fn((_bundleId: string): NativeWindow[] =>
  unconfigured("getAppWindows"),
);
export const press = vi.fn((_key: string): void => unconfigured("press"));
export const release = vi.fn((_key: string): void => unconfigured("release"));
export const tap = vi.fn((_key: string): void => unconfigured("tap"));
export const getGlobalHotkey = vi.fn((_bundleId: string, _hotkeyId: string): string | undefined =>
  unconfigured("getGlobalHotkey"),
);
export const registerGlobalHotkey = vi.fn(
  (_bundleId: string, _hotkeyId: string): string | undefined =>
    unconfigured("registerGlobalHotkey"),
);
export const setAppNeedsRelaunch = vi.fn((_bundleId: string, _needsRelaunch: boolean): void =>
  unconfigured("setAppNeedsRelaunch"),
);
export const onAppLaunch = vi.fn(
  (_bundleId: string, _callback: (app: { pid: number; bundleId: string }) => void): void =>
    unconfigured("onAppLaunch"),
);
export const onAppTerminate = vi.fn((_bundleId: string, _callback: () => void): (() => void) =>
  unconfigured("onAppTerminate"),
);
export const runSudoCommand = vi.fn(
  async (_program: string, _args: string[]): Promise<void> => unconfigured("runSudoCommand"),
);

export class Applescript {
  constructor(_source: string | ((...args: unknown[]) => unknown), ..._args: unknown[]) {
    unconfigured("Applescript");
  }
  compile(): void {
    unconfigured("Applescript.compile");
  }
  execute(): unknown {
    return unconfigured("Applescript.execute");
  }
}
