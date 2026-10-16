import { defineCommand } from "citty";
import { listMirrors } from "#list-mirrors";

export const listMirrorsCommand = defineCommand({
  meta: {
    name: "_list-mirrors",
    description: "List the KeyChord mirror for every directory under @keychord/.",
  },
  args: {
    "packages-directory": {
      type: "positional",
      description: "Directory containing the packages to inspect.",
      required: true,
    },
  },
  run({ args }) {
    const mirrors = listMirrors(args["packages-directory"]);
    if (mirrors.length) {
      console.log(mirrors.map(({ name, url }) => `${name}\t${url}`).join("\n"));
    }
  },
});
