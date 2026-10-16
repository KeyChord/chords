declare module "*/monitor.node" {
  const addon: {
    focusMonitor(target: string): Promise<void>;
    setMonitorResolution(width: number, height: number): Promise<void>;
  };
  export default addon;
}
