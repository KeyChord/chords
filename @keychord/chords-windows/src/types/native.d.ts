declare module "*/window.node" {
  const addon: {
    runWindowAction(bundleId: string | undefined, action: string, request: string): Promise<void>;
  };
  export default addon;
}
