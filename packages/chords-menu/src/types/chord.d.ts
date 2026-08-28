declare module "chord" {
  /** Resolve an FFI module directory for Chord's current target triple. */
  export function resolveFfiPath(importMeta: ImportMeta, outputRelpath: string): string;
}
