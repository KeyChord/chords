import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Plugin } from "vite-plus";
import { configDefaults } from "vite-plus/test/config";

/** Preload the host module and attach per-module resolvers for Vitest handler tests. */
export function chordTestRuntime() {
  const namespace = fileURLToPath(new URL("./module-namespace.ts", import.meta.url));
  const plugin: Plugin = {
    name: "chord-testing-runtime",
    enforce: "pre",
    apply: () => process.env.VITEST === "true",
    resolveId(source, importer) {
      if (process.env.VITEST !== "true" || !importer || !/^\.\.?\/.*\.node$/.test(source)) {
        return null;
      }
      // Give vi.mock/vi.doMock a stable module identity even though the native import's
      // source-side filename is supplied by the production bundler rather than by a file.
      return resolve(dirname(importer.split("?")[0]), source);
    },
    load(id) {
      if (process.env.VITEST !== "true" || !id.endsWith(".node")) return null;
      return `throw new Error(${JSON.stringify("Mock native .node imports in vp test; run packaged native addons in Bun or the macOS VM.")});`;
    },
    transform(source, id) {
      if (process.env.VITEST !== "true") return null;
      const path = id.split("?")[0];
      if (path === namespace || path.includes("/node_modules/") || !source.includes("import.meta"))
        return null;
      return {
        code: `import { createModuleNamespace as __chordTestNamespace } from ${JSON.stringify(namespace)};\nimport.meta.chord = __chordTestNamespace(${JSON.stringify(path)});\n${source}`,
        map: null,
      };
    },
  };
  return {
    plugins: [plugin],
    test: {
      // SwiftPM checkouts under .build/ (including KeyChord/config's own tests) are not package tests.
      exclude: [...configDefaults.exclude, "**/*.vm.test.ts", "**/.build/**"],
      alias: { chord: fileURLToPath(new URL("./chord.ts", import.meta.url)) },
      setupFiles: [fileURLToPath(new URL("./vitest-setup.ts", import.meta.url))],
    },
  };
}
