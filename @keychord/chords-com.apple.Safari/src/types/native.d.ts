declare module "*/safari.node" {
  const addon: {
    runJavaScript(source: string): void;
    openDeveloperSettings(): Promise<void>;
  };
  export default addon;
}
