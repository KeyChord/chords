declare module "*/web.node" {
  const addon: { runJavaScript(source: string): void };
  export default addon;
}
