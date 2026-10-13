#!/usr/bin/env bun
import { MacOSVM, discoverMacOSTests, withVMLock } from "./vm";

const [action = "help", ...selectors] = process.argv.slice(2);
const paths = selectors.filter((path) => path !== "--");
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
    case "list":
      console.log(discoverMacOSTests(paths).join("\n"));
      break;
    case "stop":
      await withVMLock(() => vm.stop());
      break;
    case "help":
    case "--help":
      console.log(
        "chordtest setup | test [workspace-relative package/test paths...] | list | status | stop",
      );
      break;
    default:
      throw new Error(`Unknown command: ${action}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
