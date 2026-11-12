import { tap } from "chord";
import {
  awaitSpotlightClosed,
  focusSpotlight,
  isSpotlightPanelOpen,
  isSpotlightSupported,
  prepareSpotlight,
  searchSpotlight,
  type SpotlightSearch,
} from "./utils/native";

/** macOS 27 shows Spotlight in the Siri AI app, which opens it for this URL. */
const PANEL_BUNDLE_ID = "com.apple.campo";
// The Applications view, which the Dock's Apps item also opens. It is the panel's only URL;
// Back then leads to the general search. A second open closes the panel again.
const PANEL_URL = "spotlight://apps";

/**
 * Opens Spotlight's top result for a query, as typing it into Spotlight and pressing Return does.
 * `query` "" just opens Spotlight.
 */
export default function buildSpotlightHandler(timeoutMs = 5_000) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Spotlight's timeout must be a positive integer in milliseconds");
  }

  async function open(): Promise<void> {
    const child = Bun.spawn(["/usr/bin/open", "-b", PANEL_BUNDLE_ID, PANEL_URL], {
      stdout: "ignore",
      stderr: "pipe",
      timeout: timeoutMs,
    });
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    if (exitCode !== 0)
      throw new Error(`Unable to open Spotlight (exit ${exitCode}): ${stderr.trim()}`);
  }

  // Each step waits at most `timeoutMs`: Spotlight can take seconds to show its Applications
  // view, and that must not shorten the wait for the result it opens.
  async function run(query: string): Promise<void> {
    if (!(await isSpotlightSupported())) {
      throw new Error(
        "The Spotlight launcher needs macOS 27 or later. To search with `/` on this Mac, install @keychord/chords-raycast.",
      );
    }
    let search: SpotlightSearch = "closed";
    // A panel Spotlight was closing when the run began, for example because another app was
    // just activated, goes away mid-search. It is opened again once.
    for (let attempt = 0; search === "closed" && attempt < 2; attempt++) {
      // The URL toggles the panel, so it is only sent while the panel is closed.
      if (!(await isSpotlightPanelOpen())) await open();
      if (!(await prepareSpotlight(timeoutMs)))
        throw new Error(`Spotlight's search did not open within ${timeoutMs}ms`);
      if (!query) return;
      search = await searchSpotlight(query, timeoutMs);
    }
    if (search === "closed") throw new Error("Spotlight closed its search before it finished");
    if (search === "nothing") throw new Error(`Spotlight found nothing to open for “${query}”`);
    if (search === "timeout")
      throw new Error(`Spotlight found nothing for “${query}” within ${timeoutMs}ms`);
    // Return opens the selected result; Spotlight has no accessibility action that does.
    // The panel is read again and raised just before, so a change since the search sends
    // nothing, and Return reaches the panel even if another app was activated since.
    if (!(await focusSpotlight(query)))
      throw new Error(`Spotlight's results for “${query}” changed before opening one`);
    tap("enter");
    if (!(await awaitSpotlightClosed(timeoutMs))) {
      throw new Error(`Spotlight did not open its result for “${query}” within ${timeoutMs}ms`);
    }
  }

  let pending: { query: string; action: Promise<void> } | undefined;
  return function spotlight(query = ""): Promise<void> {
    if (typeof query !== "string")
      return Promise.reject(new TypeError("Spotlight's query must be a string"));
    if (pending?.query === query) return pending.action;
    const previous = pending?.action;
    const action = (
      previous ? previous.catch(() => {}).then(() => run(query)) : run(query)
    ).finally(() => {
      if (pending?.action === action) pending = undefined;
    });
    pending = { query, action };
    return action;
  };
}
