import { $ } from "dax";
import { config } from "@keychord/config";

export default config({
  plugins: [
    {
      async buildEnd() {
        await $`bun build  ./src/bin/chrome-remote-interface.ts --target=bun --outfile=./bin/chrome-remote-interface.js`;
      },
    },
  ],
});
