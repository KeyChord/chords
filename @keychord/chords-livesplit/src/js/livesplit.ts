import { runLiveSplitJavaScript } from "./livesplit/bridge";
import { buildLiveSplitJavaScript, type LiveSplitAction } from "./livesplit/page";

export type { LiveSplitAction };

// Relative to the built js/livesplit.js; the bridge is committed in the package's target/.
const bridgeLibrary = Bun.fileURLToPath(
  new URL(
    "../target/aarch64-apple-darwin/livesplit-bridge/livesplit-bridge.dylib",
    import.meta.url,
  ),
);

export default function buildHandler(processName = "LiveSplit One") {
  if (typeof processName !== "string" || !processName.trim() || processName.includes("/")) {
    throw new Error("The LiveSplit One process name must be a non-empty executable name.");
  }
  // Finish each command, including loading the bridge, before the next one reads the layout.
  let previous: Promise<unknown> = Promise.resolve();
  return function handler(action: LiveSplitAction): Promise<boolean> {
    const pending = previous.then(async () => {
      const source = buildLiveSplitJavaScript(action);
      const value = await runLiveSplitJavaScript(source, { processName, library: bridgeLibrary });
      const result = JSON.parse(String(value)) as { ok: boolean; error?: string };
      if (result.ok !== true) throw new Error(result.error ?? "LiveSplit One action failed.");
      return true;
    });
    previous = pending.catch(() => undefined);
    return pending;
  };
}
