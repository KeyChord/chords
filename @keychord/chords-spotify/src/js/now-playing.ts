export type SpotifyBarAction =
  | "BAR_PREVIOUS"
  | "BAR_NEXT"
  | "BAR_PLAY"
  | "BAR_HALT"
  | "BAR_REPEAT"
  | "BAR_LYRICS"
  | "BAR_QUEUE"
  | "BAR_CONNECT"
  | "BAR_MINIPLAYER"
  | "BAR_FULLSCREEN"
  | "BAR_SHUFFLE"
  | "BAR_SCRUB";

// Serialized into Spotify's renderer; keep every dependency inside this function.
function runInPage(action: SpotifyBarAction, seconds?: number): string {
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

    function available(element: HTMLElement | undefined, label: string): HTMLElement {
      if (
        !element ||
        !visible(element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      ) {
        throw new Error(`The ${label} control is unavailable in Spotify's Now Playing bar.`);
      }
      return element;
    }

    const bar = document.querySelector<HTMLElement>('[data-testid="now-playing-bar"]');
    if (!bar || !visible(bar)) {
      throw new Error("Spotify's Now Playing bar is unavailable.");
    }
    const find = (selector: string) =>
      [...bar.querySelectorAll<HTMLElement>(selector)].find(visible);

    if (action === "BAR_SCRUB") {
      const progress = available(find('[data-testid="playback-progressbar"]'), "Scrub");
      const range = available(
        progress.querySelector<HTMLInputElement>('input[type="range"]') ?? undefined,
        "Scrub",
      ) as HTMLInputElement;
      // Spotify's progress range uses milliseconds and a five-second keyboard step.
      // Drive its pointer release handler to seek to the exact requested second.
      const duration = Number(range.max);
      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("The current Spotify track does not have a seekable duration yet.");
      }
      const slider = available(
        progress.querySelector<HTMLElement>('[data-testid="progress-bar"]') ?? undefined,
        "Scrub",
      );
      const rect = slider.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        throw new Error("The Spotify playback progress bar is not visible.");
      }
      // Avoid advancing to the next track when the requested time exceeds its duration.
      const target = Math.min(seconds!, Math.max(0, Math.ceil(duration / 1000) - 1));
      const ratio = (target * 1000) / duration;
      const rtl = getComputedStyle(slider).direction === "rtl";
      const event = {
        bubbles: true,
        button: 0,
        pointerId: 1,
        pointerType: "mouse",
        clientX: rect.left + rect.width * (rtl ? 1 - ratio : ratio),
        clientY: rect.top + rect.height / 2,
      };
      slider.dispatchEvent(new PointerEvent("pointerdown", { ...event, buttons: 1 }));
      slider.dispatchEvent(new PointerEvent("pointerup", { ...event, buttons: 0 }));
    } else if (action === "BAR_PLAY" || action === "BAR_HALT") {
      const button = available(find('[data-testid="control-button-playpause"]'), "Play / Halt");
      const state = button.getAttribute("aria-label");
      if (state !== "Play" && state !== "Pause") {
        throw new Error("Could not determine Spotify's playback state.");
      }
      if (state === (action === "BAR_PLAY" ? "Play" : "Pause")) button.click();
    } else {
      const controls = {
        BAR_PREVIOUS: ['[data-testid="control-button-skip-back"]', "Previous"],
        BAR_NEXT: ['[data-testid="control-button-skip-forward"]', "Next"],
        BAR_REPEAT: ['[data-testid="control-button-repeat"]', "Repeat"],
        BAR_LYRICS: ['[data-testid="lyrics-button"]', "Lyrics"],
        BAR_QUEUE: ['[data-testid="control-button-queue"]', "Queue"],
        BAR_CONNECT: ['button[aria-label="Connect to a device"]', "Connect"],
        BAR_MINIPLAYER: ['[data-testid="pip-toggle-button"]', "Miniplayer"],
        BAR_FULLSCREEN: ['[data-testid="fullscreen-mode-button"]', "Fullscreen"],
        BAR_SHUFFLE: [
          '[data-testid="control-button-shuffle"], button[aria-label*="shuffle" i]',
          "Shuffle",
        ],
      };
      const [selector, label] = controls[action];
      available(find(selector), label).click();
    }
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({ ok: false, error: (error as Error).message });
  }
}

export function buildSpotifyBarJavaScript(
  action: SpotifyBarAction,
  seconds?: string | number,
): string {
  if (
    ![
      "BAR_PREVIOUS",
      "BAR_NEXT",
      "BAR_PLAY",
      "BAR_HALT",
      "BAR_REPEAT",
      "BAR_LYRICS",
      "BAR_QUEUE",
      "BAR_CONNECT",
      "BAR_MINIPLAYER",
      "BAR_FULLSCREEN",
      "BAR_SHUFFLE",
      "BAR_SCRUB",
    ].includes(action)
  ) {
    throw new Error(`Unknown Spotify action: ${action}`);
  }
  let target: number | undefined;
  if (action === "BAR_SCRUB") {
    if (typeof seconds === "string" && !/^\d+$/.test(seconds)) {
      throw new Error("Scrub time must be a non-negative safe integer.");
    }
    target = Number(seconds);
    if (!Number.isSafeInteger(target) || target < 0) {
      throw new Error("Scrub time must be a non-negative safe integer.");
    }
  }
  return `(${runInPage.toString()})(${JSON.stringify(action)}, ${JSON.stringify(target) ?? "undefined"})`;
}
