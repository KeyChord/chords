import { buildNativeAddon, hostTriple } from "@keychord/chordtest/native";
import { join, resolve } from "node:path";

// Vite+ also imports this module under Node when loading the package config.
const root = resolve(import.meta.dirname, "..");

export function buildNative(
  outputDirectory = join(root, "target", hostTriple, "menu"),
  mode: "debug" | "release" = "release",
) {
  return buildNativeAddon({
    packageRoot: root,
    product: "KeychordChordsMenuNativeMenu",
    name: "menu",
    outputDirectory,
    mode,
  });
}

if (import.meta.main) await buildNative(process.argv[2] ? resolve(process.argv[2]) : undefined);
