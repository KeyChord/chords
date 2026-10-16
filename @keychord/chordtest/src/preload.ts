/**
 * `bun test` preload for chord packages, configured in each package's `bunfig.toml`:
 *
 *   [test]
 *   preload = ["@keychord/chordtest/preload"]
 *
 * - `import "chord"` resolves to the mockable host API in `./chord.ts`.
 * - Relative `.node` imports resolve to a stub that tests replace with `mock.module(path, …)`
 *   using the same specifier; calling into an unmocked addon throws.
 * - Modules that use `import.meta` receive Chord's package-bound `import.meta.chord`.
 * - The `chord` mocks return to their unconfigured defaults before every test.
 */
import { plugin } from "bun";
import { beforeEach, mock, type Mock } from "bun:test";
import { dirname, extname, resolve } from "node:path";
import * as chord from "./chord.ts";

// Runtime plugins never see bare specifiers, so `chord` is registered as a module mock instead.
// Tests and handlers share these exports, which the beforeEach below resets.
mock.module("chord", () => chord);

const namespaceModule = Bun.fileURLToPath(new URL("./module-namespace.ts", import.meta.url));
const defaultImplementation = Symbol.for("chordtest.defaultImplementation");
const loaders: Record<string, "js" | "jsx" | "ts" | "tsx"> = {
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
};

plugin({
  name: "chord-test-runtime",
  setup(build) {
    build.onResolve({ filter: /^\.\.?\/.*\.node$/ }, ({ path, importer }) => {
      if (importer.includes("/node_modules/")) return undefined;
      // A non-`.node` path keeps Bun's Node-API loader away; mock.module resolves the same path.
      return { path: `${resolve(dirname(importer), path)}.stub.js`, namespace: "chord-native" };
    });
    build.onLoad({ filter: /.*/, namespace: "chord-native" }, () => ({
      contents: `export default new Proxy({}, {
  get() {
    throw new Error("Mock native .node imports with mock.module(); run packaged native addons in Chord or the macOS VM.");
  },
});`,
      loader: "js",
    }));

    // Same package binding and vendored layout as Chord's import.meta hook. Kept on the first
    // line so stack traces keep their line numbers.
    build.onLoad({ filter: /^(?!.*\/node_modules\/).*\.[cm]?[jt]sx?$/ }, async ({ path }) => {
      const source = await Bun.file(path).text();
      const loader = loaders[extname(path)] ?? "js";
      if (path === namespaceModule || !source.includes("import.meta")) {
        return { contents: source, loader };
      }
      return {
        contents: `import { createModuleNamespace as __chordTestNamespace } from ${JSON.stringify(namespaceModule)}; import.meta.chord = __chordTestNamespace(${JSON.stringify(path)}); ${source}`,
        loader,
      };
    });
  },
});

beforeEach(() => {
  for (const value of Object.values(chord)) {
    const original = (value as { [defaultImplementation]?: (...args: never[]) => unknown })[
      defaultImplementation
    ];
    if (!original) continue;
    // Bun's mockReset drops the implementation; restore the unconfigured default.
    (value as Mock<(...args: never[]) => unknown>).mockReset().mockImplementation(original);
  }
});
