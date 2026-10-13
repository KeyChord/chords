declare module "*/menu.node" {
  const addon: {
    runMenuAction(processName: string | undefined, action: string, value: string): Promise<void>;
  };
  export default addon;
}
