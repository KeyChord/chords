import { config } from "@keychord/config";

export default config({
  native: {
    toolsVersion: "6.2",
    languageMode: "6",
    minimumMacOSVersion: "14.0",
    targets: {
      menu: {
        dependencies: [
          {
            url: "https://github.com/openclaw/AXorcist.git",
            revision: "aa07d72fbb1861b56f5833b4cff8d9101c8dfbb3",
            products: ["AXorcist"],
          },
        ],
      },
    },
  },
});
