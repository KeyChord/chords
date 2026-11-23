declare module "*/safari.node" {
  const addon: {
    runJavaScript(source: string): void;
    openDeveloperSettings(): Promise<void>;
    moveTab(direction: "LEFT" | "RIGHT"): Promise<void>;
    moveTabGroup(direction: "LEFT" | "RIGHT"): Promise<void>;
  };
  export default addon;
}
