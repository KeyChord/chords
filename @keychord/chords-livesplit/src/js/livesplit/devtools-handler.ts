import { runLiveSplitDevTools, type LiveSplitTarget } from "./devtools";
import { buildLiveSplitJavaScript, type LiveSplitAction } from "./page";

export function buildDevToolsHandler(port: number, mode: LiveSplitTarget) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The LiveSplit One debugging port must be an integer between 1 and 65535.");
  }

  let previous: Promise<unknown> = Promise.resolve();
  return function handler(action: LiveSplitAction): Promise<boolean> {
    const pending = previous.then(async () => {
      const body = buildLiveSplitJavaScript(action);
      const value = await runLiveSplitDevTools(body, port, mode);
      const result = JSON.parse(String(value)) as { ok: boolean; error?: string };
      if (result.ok !== true) throw new Error(result.error ?? "LiveSplit One action failed.");
      return true;
    });
    previous = pending.catch(() => undefined);
    return pending;
  };
}
