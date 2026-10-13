declare module "*/window.node" {
  const addon: {
    runWindowAction(bundleId: string | undefined, action: string, request: string): Promise<void>;
  };
  export default addon;
}

declare module "*/monitor.node" {
  const addon: {
    focusMonitor(target: string): Promise<void>;
    setMonitorResolution(width: number, height: number): Promise<void>;
  };
  export default addon;
}
