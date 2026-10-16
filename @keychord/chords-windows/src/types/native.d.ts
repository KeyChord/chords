declare module "*/window.node" {
  const addon: {
    cycleWindows(bundleId: string | undefined, direction: string): Promise<void>;
    moveWindowToSpace(
      bundleId: string | undefined,
      windowId: number | null,
      target: string,
    ): Promise<void>;
    runWindowAction(
      bundleId: string | undefined,
      windowId: number | null,
      action: string,
      request: string,
    ): Promise<void>;
  };
  export default addon;
}
