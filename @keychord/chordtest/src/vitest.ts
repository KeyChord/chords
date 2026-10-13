import { fileURLToPath } from "node:url";
import type { Plugin } from "vite-plus";
import { configDefaults } from "vite-plus/test/config";

/** Preload the host module and attach per-module resolvers for Vitest handler tests. */
export function chordTestRuntime() {
  const namespace = fileURLToPath(new URL("./module-namespace.ts", import.meta.url));
  const plugin: Plugin = {
    name: "chord-testing-runtime",
    enforce: "pre",
    apply: () => process.env.VITEST === "true",
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
      exclude: [...configDefaults.exclude, "**/*.vm.test.ts"],
      alias: { chord: fileURLToPath(new URL("./chord.ts", import.meta.url)) },
      setupFiles: [fileURLToPath(new URL("./vitest-setup.ts", import.meta.url))],
    },
  };
}
