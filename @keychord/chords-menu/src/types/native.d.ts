declare module "*/menu.node" {
  const addon: {
    runTrayAction(type: string, value: string, action: string): Promise<void>;
    runMenuBarAction(
      app: string | undefined,
      scope: string,
      index: string,
      steps: string,
      click: string,
    ): Promise<void>;
    runMenuAction(processName: string | undefined, action: string, value: string): Promise<void>;
  };
  export default addon;
}
