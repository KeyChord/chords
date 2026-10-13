declare module "*/raycast.node" {
  const addon: {
    readState(): Promise<string>;
    setSearch(query: string, remainingMs: number): Promise<string>;
    activateSearch(query: string, fingerprint: string, remainingMs: number): Promise<string>;
    returnToRoot(fingerprint: string, remainingMs: number): Promise<string>;
  };
  export default addon;
}
