import { join } from "node:path";
import { prepareMacOSPackage } from "./macos";
import { requireMacOSVM } from "./runtime";

requireMacOSVM();
for (const path of new Bun.Glob("@keychord/*/Package.swift").scanSync()) {
  await prepareMacOSPackage(join(process.cwd(), path, ".."));
}
