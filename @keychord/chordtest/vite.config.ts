import { defineConfig } from "vite-plus";
import { configDefaults } from "vite-plus/test/config";
import { chordTestRuntime } from "./src/vitest";

const runtime = chordTestRuntime();

export default defineConfig({
  ...runtime,
  test: { ...runtime.test, exclude: [...configDefaults.exclude, "__tests__/vm.test.ts"] },
  pack: { entry: ["src/index.ts", "src/cli.ts"], dts: false, deps: { neverBundle: ["bun:ffi"] } },
});
