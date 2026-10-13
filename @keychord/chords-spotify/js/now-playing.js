//#region src/js/now-playing.ts
function runInPage(action, seconds) {
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
    function available(element, label) {
      if (
        !element ||
        !visible(element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      )
        throw new Error(`The ${label} control is unavailable in Spotify's Now Playing bar.`);
      return element;
    }
    const bar = document.querySelector('[data-testid="now-playing-bar"]');
    if (!bar || !visible(bar)) throw new Error("Spotify's Now Playing bar is unavailable.");
    const find = (selector) => [...bar.querySelectorAll(selector)].find(visible);
    if (action === "bar-scrub") {
      const progress = available(find('[data-testid="playback-progressbar"]'), "Scrub");
      const range = available(progress.querySelector('input[type="range"]') ?? void 0, "Scrub");
      const duration = Number(range.max);
      if (!Number.isFinite(duration) || duration <= 0)
        throw new Error("The current Spotify track does not have a seekable duration yet.");
      const slider = available(
        progress.querySelector('[data-testid="progress-bar"]') ?? void 0,
        "Scrub",
      );
      const rect = slider.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0)
        throw new Error("The Spotify playback progress bar is not visible.");
      const ratio =
        (Math.min(seconds, Math.max(0, Math.ceil(duration / 1e3) - 1)) * 1e3) / duration;
      const rtl = getComputedStyle(slider).direction === "rtl";
      const event = {
        bubbles: true,
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
        clientX: rect.left + rect.width * (rtl ? 1 - ratio : ratio),
        clientY: rect.top + rect.height / 2,
      };
      slider.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...event,
          buttons: 1,
        }),
      );
      slider.dispatchEvent(
        new PointerEvent("pointerup", {
          ...event,
          buttons: 0,
        }),
      );
    } else if (action === "bar-play" || action === "bar-halt") {
      const button = available(find('[data-testid="control-button-playpause"]'), "Play / Halt");
      const state = button.getAttribute("aria-label");
      if (state !== "Play" && state !== "Pause")
        throw new Error("Could not determine Spotify's playback state.");
      if (state === (action === "bar-play" ? "Play" : "Pause")) button.click();
    } else {
      const [selector, label] = {
        "bar-previous": ['[data-testid="control-button-skip-back"]', "Previous"],
        "bar-next": ['[data-testid="control-button-skip-forward"]', "Next"],
        "bar-repeat": ['[data-testid="control-button-repeat"]', "Repeat"],
        "bar-lyrics": ['[data-testid="lyrics-button"]', "Lyrics"],
        "bar-queue": ['[data-testid="control-button-queue"]', "Queue"],
        "bar-connect": ['button[aria-label="Connect to a device"]', "Connect"],
        "bar-miniplayer": ['[data-testid="pip-toggle-button"]', "Miniplayer"],
        "bar-fullscreen": ['[data-testid="fullscreen-mode-button"]', "Fullscreen"],
        "bar-shuffle": [
          '[data-testid="control-button-shuffle"], button[aria-label*="shuffle" i]',
          "Shuffle",
        ],
      }[action];
      available(find(selector), label).click();
    }
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error.message,
    });
  }
}
function buildSpotifyBarJavaScript(action, seconds) {
  if (
    ![
      "bar-previous",
      "bar-next",
      "bar-play",
      "bar-halt",
      "bar-repeat",
      "bar-lyrics",
      "bar-queue",
      "bar-connect",
      "bar-miniplayer",
      "bar-fullscreen",
      "bar-shuffle",
      "bar-scrub",
    ].includes(action)
  )
    throw new Error(`Unknown Spotify action: ${action}`);
  let target;
  if (action === "bar-scrub") {
    if (typeof seconds === "string" && !/^\d+$/.test(seconds))
      throw new Error("Scrub time must be a non-negative safe integer.");
    target = Number(seconds);
    if (!Number.isSafeInteger(target) || target < 0)
      throw new Error("Scrub time must be a non-negative safe integer.");
  }
  return `(${runInPage.toString()})(${JSON.stringify(action)}, ${JSON.stringify(target) ?? "undefined"})`;
}
//#endregion
export { buildSpotifyBarJavaScript };
