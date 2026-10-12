declare module "chord" {
  type ObservedApp = { pid: number; bundleId: string };
  export function onAppLaunch(bundleId: string, callback: (app: ObservedApp) => void): void;
  export function onAppTerminate(
    bundleId: string,
    callback: (app: ObservedApp) => void,
  ): () => void;
  export function setAppNeedsRelaunch(bundleId: string, needsRelaunch: boolean): void;
}
