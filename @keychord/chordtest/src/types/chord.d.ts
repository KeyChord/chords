// Types for chordtest's own tests. At runtime the preload supplies `../chord.ts` as `chord`;
// a tsconfig `paths` alias would also redirect that runtime mock away from the bare specifier.
declare module "chord" {
  type Double = typeof import("../chord");
  export type WindowBounds = import("../chord").WindowBounds;
  export type NativeWindow = import("../chord").NativeWindow;
  export const getScreenBounds: Double["getScreenBounds"];
  export const mouse: Double["mouse"];
  export const click: Double["click"];
  export const getAppWindows: Double["getAppWindows"];
  export const press: Double["press"];
  export const release: Double["release"];
  export const tap: Double["tap"];
  export const getGlobalHotkey: Double["getGlobalHotkey"];
  export const registerGlobalHotkey: Double["registerGlobalHotkey"];
  export const setAppNeedsRelaunch: Double["setAppNeedsRelaunch"];
  export const onAppLaunch: Double["onAppLaunch"];
  export const onAppTerminate: Double["onAppTerminate"];
  export const runSudoCommand: Double["runSudoCommand"];
  export const Applescript: Double["Applescript"];
}
