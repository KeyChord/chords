declare module "*/spaces.node" {
  const addon: { switchSpace(command: string): Promise<void> };
  export default addon;
}
