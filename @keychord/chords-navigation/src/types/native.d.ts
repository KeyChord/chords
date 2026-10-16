declare module "*/navigation.node" {
  const addon: { perform(bundleId: string, request: string): Promise<string> };
  export default addon;
}
