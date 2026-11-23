declare module "*/application.node" {
  const addon: {
    cycleApplication(bundleId: string | undefined, direction: string): Promise<void>;
    runDockItem(index: number, action: "FOCUS" | "LEFT" | "RIGHT"): Promise<void>;
  };
  export default addon;
}
