declare module "*/raycast.node" {
  const addon: {
    readState(): Promise<string>;
    setSearch(query: string): Promise<string>;
    activateSearch(query: string, fingerprint: string): Promise<string>;
  };
  export default addon;
}
