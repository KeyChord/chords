import { buildInstagramJavaScript, type InstagramAction } from "./page";
import { runDesktopInstagramJavaScript, runInstagramJavaScript } from "./instagram/cdp";
import { configureBraveDebugging } from "./instagram/browser";

const braveAppIds = new Set([
  "com.brave.browser",
  "executable.brave",
  "executable.brave-browser",
  "executable.brave-browser-stable",
  "executable.brave-browser-beta",
  "executable.brave-browser-nightly",
]);

export default function buildHandler(port = 9222, mode: "macos" | "desktop" = "macos") {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The Instagram debugging port must be an integer between 1 and 65535.");
  }
  let startup = mode === "desktop" ? Promise.resolve() : configureBraveDebugging(port);
  // Surface setup failures through the first chord as well as Chord's runtime log.
  void startup.catch((error) => console.error("Could not enable Brave debugging:", error));
  let previous: Promise<unknown> = Promise.resolve();
  return function handler(
    this: { focusedAppId?: string | null } | void,
    action: InstagramAction,
    storyNumber?: string | number,
  ): Promise<boolean> {
    const pending = previous.then(async () => {
      const source = buildInstagramJavaScript(action, storyNumber);
      if (mode === "desktop" && !braveAppIds.has(this?.focusedAppId?.toLowerCase() ?? "")) {
        throw new Error("Focus Instagram in Brave before using Instagram chords.");
      }
      const initializing = startup;
      startup = Promise.resolve();
      await initializing;
      const run = mode === "desktop" ? runDesktopInstagramJavaScript : runInstagramJavaScript;
      const value = await run(source, port);
      const result = JSON.parse(String(value)) as { ok: boolean; error?: string };
      if (result.ok !== true) throw new Error(result.error ?? "Instagram action failed.");
      return true;
    });
    // Chords entered quickly must complete in order, including pan followed by panx.
    previous = pending.catch(() => undefined);
    return pending;
  };
}
