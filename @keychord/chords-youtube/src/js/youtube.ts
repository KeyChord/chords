import { buildYouTubeJavaScript, type YouTubeAction } from "./page";
import { runYouTubeJavaScript } from "./youtube/cdp";

export default function buildHandler(port = 9222) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The YouTube debugging port must be an integer between 1 and 65535.");
  }
  return async function handler(action: YouTubeAction, seconds?: string | number) {
    const source = buildYouTubeJavaScript(action, seconds);
    const value = await runYouTubeJavaScript(source, port);
    const result = JSON.parse(String(value)) as { ok: boolean; error?: string };
    if (!result.ok) throw new Error(result.error ?? "YouTube action failed.");
    return true;
  };
}
