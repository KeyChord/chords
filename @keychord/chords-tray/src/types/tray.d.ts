declare module "*/tray.node" {
  const addon: {
    runTrayAction(type: string, value: string, action: string): Promise<void>;
  };
  export default addon;
}
