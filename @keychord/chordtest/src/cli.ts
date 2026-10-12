#!/usr/bin/env bun
import { MacOSVM, withVMLock } from "./vm";

const [action = "help", ...paths] = process.argv.slice(2);
try {
  const vm = new MacOSVM();
  switch (action) {
    case "setup":
      await withVMLock(() => vm.setup());
      break;
    case "test":
      await withVMLock(() => vm.test(paths));
      break;
    case "status":
      console.log((await vm.status()) ?? "The shared macOS VM has not been created.");
      break;
    case "stop":
      await withVMLock(() => vm.stop());
      break;
    case "help":
    case "--help":
      console.log("chordtest setup | test [workspace-relative test paths...] | status | stop");
      break;
    default:
      throw new Error(`Unknown command: ${action}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
