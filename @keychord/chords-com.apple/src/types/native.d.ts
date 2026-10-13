declare module "*/safari.node" {
  const addon: {
    runJavaScript(source: string): void;
    openDeveloperSettings(): void;
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
