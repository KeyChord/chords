import { buildDevToolsHandler } from "./livesplit/devtools-handler";

export default function buildHandler(port = 9422) {
  return buildDevToolsHandler(port, "webview2");
}
