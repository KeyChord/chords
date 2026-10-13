import { config } from "@keychord/config";
import { buildNative } from "./scripts/build-native";

const trayConfig = config();
let nativeBuild: ReturnType<typeof buildNative> | undefined;

export default {
  ...trayConfig,
  pack: trayConfig.pack.map((entry) => ({
    ...entry,
    hooks: {
      "build:prepare": async () => {
        if (!process.env.CHORD_SKIP_NATIVE) await (nativeBuild ??= buildNative());
      },
    },
  })),
};
