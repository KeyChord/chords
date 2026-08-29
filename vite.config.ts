import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {},
  staged: {
    "*.{js,ts,tsx,json}": "vp fmt",
    // Native addons are committed and synced to the mirrors as-is (CI does not
    // build them), so a .swift change must ship with rebuilt artifacts.
    "packages/*/src/swift/**/*.swift": "./scripts/check-native-artifacts.sh",
  },
});
