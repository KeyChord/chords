import { defineConfig } from "vite-plus";

// Tests run with `bun test` in each package (`vp run -r test`), not Vitest.
export default defineConfig({
  fmt: {
    // Oxfmt preserves TOML key quotes, including optional single quotes on chord bindings.
    ignorePatterns: [".github/workflows/*.yml"],
  },
  staged: {
    "*.{js,ts,tsx,json,toml}": "vp fmt",
  },
});
