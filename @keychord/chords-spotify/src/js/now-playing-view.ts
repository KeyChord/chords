export type SpotifyNowPlayingAction =
  | "NP_TOGGLE"
  | "NP_HIDE"
  | "NP_EXPAND"
  | "NP_MINIMIZE"
  | "NP_ARTWORK"
  | "NP_CANVAS"
  | "NP_ARTIST_IMAGE"
  | "NP_LYRICS";

// Serialized into Spotify's renderer; keep every dependency inside this function.
async function runInPage(action: SpotifyNowPlayingAction): Promise<string> {
  try {
    if (location.hostname !== "xpui.app.spotify.com") {
      throw new Error("The selected page is not the Spotify desktop app.");
    }

    function visible(element: HTMLElement): boolean {
      if (!element.isConnected || element.closest('[hidden], [aria-hidden="true"], [inert]')) {
        return false;
      }
      for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    }

    const find = (selector: string, scope: ParentNode = document) =>
      [...scope.querySelectorAll<HTMLElement>(selector)].find(visible);
    const panel = () => find('aside[aria-label="Now playing view"]');
    const minimize = () => find('button[aria-label="Minimize Now Playing view"]');
    const isOpen = () => !!(minimize() || panel());

    function click(element: HTMLElement | undefined, label: string): void {
      if (
        !element ||
        !visible(element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      ) {
        throw new Error(`The ${label} control is unavailable in Spotify's Now Playing view.`);
      }
      element.click();
    }

    function waitFor<T>(find: () => T | undefined, message: string): Promise<T> {
      const found = find();
      if (found !== undefined) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          const value = find();
          if (value !== undefined) {
            clearTimeout(timer);
            observer.disconnect();
            resolve(value);
          }
        });
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error(message));
        }, 1500);
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
        });
      });
    }

    async function collapse(): Promise<void> {
      const button = minimize();
      if (!button) return;
      click(button, "Minimize");
      await waitFor(
        () => (!minimize() && panel()) || undefined,
        "Spotify did not minimize the Now Playing view.",
      );
    }

    if (action === "NP_HIDE" || action === "NP_TOGGLE") {
      if (isOpen()) {
        // Clicking the cover in the expanded view only minimizes it. Collapse first,
        // then hide the sidebar so Toggle and Hide both reach the hidden state.
        await collapse();
        click(
          find('button[aria-label="Hide Now Playing view"]', panel()) ??
            find('[data-testid="now-playing-bar"] [data-testid="cover-art-button"]'),
          "Hide",
        );
        await waitFor(
          () => (!isOpen() ? true : undefined),
          "Spotify did not hide the Now Playing view.",
        );
        return JSON.stringify({ ok: true });
      }
      if (action === "NP_HIDE") return JSON.stringify({ ok: true });
    }

    if (action === "NP_MINIMIZE") {
      await collapse();
      return JSON.stringify({ ok: true });
    }

    if (!isOpen()) {
      click(
        find('button[aria-label="Show Now Playing view"]') ??
          find('[data-testid="now-playing-bar"] [data-testid="cover-art-button"]'),
        "Show",
      );
      await waitFor(
        () => (isOpen() ? true : undefined),
        "Spotify did not open the Now Playing view.",
      );
    }
    if (action === "NP_TOGGLE") return JSON.stringify({ ok: true });

    if (!minimize()) {
      click(find('button[aria-label="Expand Now Playing view"]', panel()), "Expand");
      await waitFor(minimize, "Spotify did not expand the Now Playing view.");
    }
    if (action === "NP_EXPAND") return JSON.stringify({ ok: true });

    const views = {
      NP_ARTWORK: ["artwork", "Artwork"],
      NP_CANVAS: ["canvas", "Canvas"],
      NP_ARTIST_IMAGE: ["hero", "Artist image"],
      NP_LYRICS: ["lyrics", "Lyrics"],
    };
    const [value, label] = views[action];
    const selector = `[role="radiogroup"][aria-label="Media control options"] button[role="radio"][value="${value}"]`;
    const radio = find(selector);
    if (radio?.getAttribute("aria-checked") !== "true") {
      click(radio, label);
      await waitFor(
        () => (find(selector)?.getAttribute("aria-checked") === "true" ? true : undefined),
        `Spotify did not select ${label} in the Now Playing view.`,
      );
    }
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({ ok: false, error: (error as Error).message });
  }
}

export function buildSpotifyNowPlayingJavaScript(action: SpotifyNowPlayingAction): string {
  if (
    ![
      "NP_TOGGLE",
      "NP_HIDE",
      "NP_EXPAND",
      "NP_MINIMIZE",
      "NP_ARTWORK",
      "NP_CANVAS",
      "NP_ARTIST_IMAGE",
      "NP_LYRICS",
    ].includes(action)
  ) {
    throw new Error(`Unknown Spotify action: ${action}`);
  }
  return `(${runInPage.toString()})(${JSON.stringify(action)})`;
}
