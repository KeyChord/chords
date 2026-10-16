import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: { entry: ["src/index.ts", "src/cli.ts"], dts: false, deps: { neverBundle: ["bun:ffi"] } },
});
