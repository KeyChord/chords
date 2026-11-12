declare module "*/spotlight.node" {
  const addon: {
    isSupported(): Promise<string>;
    isPanelOpen(): Promise<string>;
    prepare(remainingMs: number): Promise<string>;
    search(query: string, remainingMs: number): Promise<string>;
    focus(query: string): Promise<string>;
    awaitClosed(remainingMs: number): Promise<string>;
  };
  export default addon;
}
