/**
 * Chord attaches `import.meta.chord` to each module as it loads it. The test runner does not, and
 * `import.meta` is per-module, so a test file cannot set it on the module under test.
 *
 * Every `import.meta` in this runner shares one prototype, so defining the namespace there reaches
 * each module while leaving its own properties untouched.
 */
Object.defineProperty(Object.getPrototypeOf(import.meta) as object, "chord", {
  configurable: true,
  value: {
    resolveNative: (relpath: string) => `/fixture/${relpath}.node`,
    resolvePackageFile: (relpath: string) => `/fixture/${relpath}`,
  },
});
