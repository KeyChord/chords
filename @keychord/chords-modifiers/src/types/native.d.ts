declare module "*.node" {
  const addon: { tapWithFunctionKey(shortcut: string): Promise<void> };
  export default addon;
}
