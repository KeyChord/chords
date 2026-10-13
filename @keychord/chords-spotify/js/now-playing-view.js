//#region src/js/now-playing-view.ts
async function runInPage(action) {
  try {
    if (location.hostname !== "xpui.app.spotify.com")
      throw new Error("The selected page is not the Spotify desktop app.");
    function visible(element) {
      if (!element.isConnected || element.closest('[hidden], [aria-hidden="true"], [inert]'))
        return false;
      for (let parent = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden") return false;
      }
      return true;
    }
    const find = (selector, scope = document) =>
      [...scope.querySelectorAll(selector)].find(visible);
    const panel = () => find('aside[aria-label="Now playing view"]');
    const minimize = () => find('button[aria-label="Minimize Now Playing view"]');
    const isOpen = () => !!(minimize() || panel());
    function click(element, label) {
      if (
        !element ||
        !visible(element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      )
        throw new Error(`The ${label} control is unavailable in Spotify's Now Playing view.`);
      element.click();
    }
    function waitFor(find, message) {
      const found = find();
      if (found !== void 0) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          const value = find();
          if (value !== void 0) {
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
    async function collapse() {
      const button = minimize();
      if (!button) return;
      click(button, "Minimize");
      await waitFor(
        () => (!minimize() && panel()) || void 0,
        "Spotify did not minimize the Now Playing view.",
      );
    }
    if (action === "np-hide" || action === "np-toggle") {
      if (isOpen()) {
        await collapse();
        click(
          find('button[aria-label="Hide Now Playing view"]', panel()) ??
            find('[data-testid="now-playing-bar"] [data-testid="cover-art-button"]'),
          "Hide",
        );
        await waitFor(
          () => (!isOpen() ? true : void 0),
          "Spotify did not hide the Now Playing view.",
        );
        return JSON.stringify({ ok: true });
      }
      if (action === "np-hide") return JSON.stringify({ ok: true });
    }
    if (action === "np-minimize") {
      await collapse();
      return JSON.stringify({ ok: true });
    }
    if (!isOpen()) {
      click(
        find('button[aria-label="Show Now Playing view"]') ??
          find('[data-testid="now-playing-bar"] [data-testid="cover-art-button"]'),
        "Show",
      );
      await waitFor(() => (isOpen() ? true : void 0), "Spotify did not open the Now Playing view.");
    }
    if (action === "np-toggle") return JSON.stringify({ ok: true });
    if (!minimize()) {
      click(find('button[aria-label="Expand Now Playing view"]', panel()), "Expand");
      await waitFor(minimize, "Spotify did not expand the Now Playing view.");
    }
    if (action === "np-expand") return JSON.stringify({ ok: true });
    const [value, label] = {
      "np-artwork": ["artwork", "Artwork"],
      "np-canvas": ["canvas", "Canvas"],
      "np-artist-image": ["hero", "Artist image"],
      "np-lyrics": ["lyrics", "Lyrics"],
    }[action];
    const selector = `[role="radiogroup"][aria-label="Media control options"] button[role="radio"][value="${value}"]`;
    const radio = find(selector);
    if (radio?.getAttribute("aria-checked") !== "true") {
      click(radio, label);
      await waitFor(
        () => (find(selector)?.getAttribute("aria-checked") === "true" ? true : void 0),
        `Spotify did not select ${label} in the Now Playing view.`,
      );
    }
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error.message,
    });
  }
}
function buildSpotifyNowPlayingJavaScript(action) {
  if (
    ![
      "np-toggle",
      "np-hide",
      "np-expand",
      "np-minimize",
      "np-artwork",
      "np-canvas",
      "np-artist-image",
      "np-lyrics",
    ].includes(action)
  )
    throw new Error(`Unknown Spotify action: ${action}`);
  return `(${runInPage.toString()})(${JSON.stringify(action)})`;
}
//#endregion
export { buildSpotifyNowPlayingJavaScript };
