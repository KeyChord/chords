declare module "chord" {
  /** Resolve a NodeSwift addon for Chord's current target triple. */
  export function resolveNativeModulePath(importMeta: ImportMeta, outputRelpath: string): string;
}
