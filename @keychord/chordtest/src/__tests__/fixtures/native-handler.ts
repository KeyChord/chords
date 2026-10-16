// Imported by test-runtime.test.ts to exercise the preload's `.node` stub.
import addon from "./probe.node";

export function callAddon(): string {
  return addon.probe();
}
