import { defineCommand } from "citty";
import { syncMirrors } from "#sync-mirrors";

export const syncMirrorsCommand = defineCommand({
  meta: {
    name: "_sync-mirrors",
    description: "Sync package mirrors using the configured environment; CI enables pushes.",
  },
  run() {
    syncMirrors();
  },
});
