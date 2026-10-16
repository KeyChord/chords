declare module "*/safari.node" {
  const addon: {
    runJavaScript(source: string): void;
    openDeveloperSettings(): Promise<void>;
  };
  export default addon;
}

declare module "*/screenContinuity.node" {
  const addon: {
    getScreenBounds(): Promise<string>;
    validateScreenBounds(bounds: string): Promise<void>;
  };
  export default addon;
}
