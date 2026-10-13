import { defineConfig } from "vite-plus";
import { configDefaults } from "vite-plus/test/config";
import { chordTestRuntime } from "@keychord/chordtest/vitest";

const runtime = chordTestRuntime();

export default defineConfig({
  ...runtime,
  fmt: {},
  test: {
    ...runtime.test,
    // This package tests its native addon and TOML loader using Bun's runtime.
    exclude: [
      ...configDefaults.exclude,
      ".chord-testing/**",
      "@keychord/chords-tray/__tests__/**",
      "@keychord/chordtest/__tests__/**",
      "**/*.vm.test.ts",
    ],
  },
  staged: {
    "*.{js,ts,tsx,json}": "vp fmt",
  },
});
