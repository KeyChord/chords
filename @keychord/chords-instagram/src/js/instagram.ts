import { buildInstagramJavaScript, type InstagramAction } from "./page";
import { runInstagramJavaScript } from "./instagram/cdp";
import { configureBraveDebugging } from "./instagram/browser";

export default function buildHandler(port = 9222) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("The Instagram debugging port must be an integer between 1 and 65535.");
  }
  let startup = configureBraveDebugging(port);
  // Surface setup failures through the first chord as well as Chord's runtime log.
  void startup.catch((error) => console.error("Could not enable Brave debugging:", error));
  let previous: Promise<unknown> = Promise.resolve();
  return function handler(
    action: InstagramAction,
    storyNumber?: string | number,
  ): Promise<boolean> {
    const pending = previous.then(async () => {
      const source = buildInstagramJavaScript(action, storyNumber);
      const initializing = startup;
      startup = Promise.resolve();
      await initializing;
      const value = await runInstagramJavaScript(source, port);
      const result = JSON.parse(String(value)) as { ok: boolean; error?: string };
      if (result.ok !== true) throw new Error(result.error ?? "Instagram action failed.");
      return true;
    });
    // Chords entered quickly must complete in order, including pan followed by panx.
    previous = pending.catch(() => undefined);
    return pending;
  };
}
