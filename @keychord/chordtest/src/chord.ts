/** The built-in `chord` module preloaded by the unit-test runtime. */
import { mock } from "bun:test";

function unconfigured(name: string): never {
  throw new Error(`chord.${name} is not configured in this test; mock the preloaded chord export`);
}

/** A mock whose default implementation the preload restores before each test. */
function chordMock<T extends (...args: any[]) => any>(implementation: T) {
  return Object.assign(mock(implementation), {
    [Symbol.for("chordtest.defaultImplementation")]: implementation,
  });
}

export type WindowBounds = { x: number; y: number; width: number; height: number };
export type NativeWindow = {
  windowId: number;
  processId: number;
  bounds: WindowBounds;
  title: string | null;
};

export const getScreenBounds = chordMock((): WindowBounds => unconfigured("getScreenBounds"));
export const mouse = chordMock(
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

export const click = chordMock(
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
export const getAppWindows = chordMock((_bundleId: string): NativeWindow[] =>
  unconfigured("getAppWindows"),
);
export const press = chordMock((_key: string): void => unconfigured("press"));
export const release = chordMock((_key: string): void => unconfigured("release"));
export const tap = chordMock((_key: string): void => unconfigured("tap"));
export const getGlobalHotkey = chordMock((_bundleId: string, _hotkeyId: string): string | undefined =>
  unconfigured("getGlobalHotkey"),
);
export const registerGlobalHotkey = chordMock(
  (_bundleId: string, _hotkeyId: string): string | undefined =>
    unconfigured("registerGlobalHotkey"),
);
export const setAppNeedsRelaunch = chordMock((_bundleId: string, _needsRelaunch: boolean): void =>
  unconfigured("setAppNeedsRelaunch"),
);
export const onAppLaunch = chordMock(
  (_bundleId: string, _callback: (app: { pid: number; bundleId: string }) => void): void =>
    unconfigured("onAppLaunch"),
);
export const onAppTerminate = chordMock((_bundleId: string, _callback: () => void): (() => void) =>
  unconfigured("onAppTerminate"),
);
export const runSudoCommand = chordMock(async (_program: string, _args: string[]): Promise<void> =>
  unconfigured("runSudoCommand"),
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
