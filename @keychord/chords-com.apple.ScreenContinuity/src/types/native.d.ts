declare module "*/screenContinuity.node" {
  const addon: {
    getScreenBounds(): Promise<string>;
    validateScreenBounds(bounds: string): Promise<void>;
  };
  export default addon;
}
