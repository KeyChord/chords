declare module "*/application.node" {
  const addon: {
    cycleApplication(bundleId: string | undefined, direction: string): Promise<void>;
  };
  export default addon;
}
