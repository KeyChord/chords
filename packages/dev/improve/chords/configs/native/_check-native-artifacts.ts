#!/usr/bin/env node
import { runMain } from "citty";
import { checkNativeArtifactsCommand } from "#check-native-artifacts-command";

await runMain(checkNativeArtifactsCommand);
