import { defineCommand } from "citty";
import { checkNativeArtifacts } from "#check-native-artifacts";

export const checkNativeArtifactsCommand = defineCommand({
  meta: {
    name: "_check-native-artifacts",
    description: "Check that committed native artifacts match their Swift sources.",
  },
  run() {
    process.exitCode = checkNativeArtifacts();
  },
});
