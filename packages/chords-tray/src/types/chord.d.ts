declare module "chord" {
  /** Resolve a package-relative native handler library for Chord's current target triple. */
  export function resolveFfiPath(importMeta: ImportMeta, outputRelpath: string): string;
}
