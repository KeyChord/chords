import { buildDevToolsHandler } from "./livesplit/devtools-handler";
import type { LiveSplitAction } from "./livesplit/page";

export default function buildHandler(port = 9423) {
  const run = buildDevToolsHandler(port, "chromium");
  return function handler(
    this: { focusedAppId?: string },
    action: LiveSplitAction,
  ): Promise<boolean> {
    if (this?.focusedAppId !== "org.livesplit.one") {
      throw new Error("Focus the LiveSplit One timer window before using this chord.");
    }
    return run(action);
  };
}
