import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  staged: {
    "*.{js,ts,tsx,json}": "vp fmt",
  },
});
