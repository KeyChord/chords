let addon: Promise<typeof import("./spotlight.node")> | undefined;
const native = async () => (await (addon ??= import("./spotlight.node"))).default;

/** Whether this Mac has the Spotlight panel the launcher drives (macOS 27's Siri AI app). */
export async function isSpotlightSupported(): Promise<boolean> {
  return JSON.parse(await (await native()).isSupported());
}

export async function isSpotlightPanelOpen(): Promise<boolean> {
  return JSON.parse(await (await native()).isPanelOpen());
}

/** Waits for the panel and leaves any scoped view; false if it never opened. */
export async function prepareSpotlight(remainingMs: number): Promise<boolean> {
  return JSON.parse(await (await native()).prepare(remainingMs));
}

export type SpotlightSearch = "ready" | "nothing" | "timeout" | "closed";

/**
 * Runs `query` from an empty search and waits until Spotlight selects a result for it. "closed"
 * means the panel went away first.
 */
export async function searchSpotlight(
  query: string,
  remainingMs: number,
): Promise<SpotlightSearch> {
  return (await (await native()).search(query, remainingMs)) as SpotlightSearch;
}

/**
 * Re-reads the panel: still showing a result selected for `query`. If so, raises it, so it has
 * the keyboard even after another app was activated since it opened.
 */
export async function focusSpotlight(query: string): Promise<boolean> {
  return JSON.parse(await (await native()).focus(query));
}

/** Resolves true once the panel closes, which Spotlight does after opening the result. */
export async function awaitSpotlightClosed(remainingMs: number): Promise<boolean> {
  return JSON.parse(await (await native()).awaitClosed(remainingMs));
}
