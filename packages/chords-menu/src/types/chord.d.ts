declare global {
  interface ImportMeta {
    /** Chord's per-module helpers, attached by the runtime to every module it loads. */
    chord: {
      /** Resolve a NodeSwift addon for Chord's current target triple. */
      resolveNative(outputRelpath: string): string;
      /** Resolve a file of this module's package, relative to the package root. */
      resolvePackageFile(relpath: string): string;
    };
  }
}

export {};
