export type YouTubeAction =
  | "search"
  | "seek"
  | "play"
  | "pause"
  | "mute"
  | "autoplay"
  | "captions"
  | "settings"
  | "theater"
  | "fullscreen";

// This function is serialized into the page. Keep it independent of module scope.
function runInPage(action: YouTubeAction, seconds?: number): string {
  try {
    if (location.hostname !== "youtube.com" && !location.hostname.endsWith(".youtube.com")) {
      throw new Error("The active Brave window is not YouTube.");
    }

    if (action === "search") {
      const input = document.querySelector<HTMLInputElement>('input[name="search_query"]');
      if (!input) throw new Error("The YouTube search field is unavailable.");
      input.focus();
      input.select();
      return JSON.stringify({ ok: true });
    }

    const player = document.querySelector<
      HTMLElement & {
        seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
        playVideo?: () => void;
        pauseVideo?: () => void;
      }
    >("#movie_player");
    const video = player?.querySelector("video");
    if (!player || !video) throw new Error("Open a YouTube video before using video chords.");

    switch (action) {
      case "seek": {
        if (!Number.isSafeInteger(seconds) || seconds! < 0) {
          throw new Error("Seek time must be a non-negative safe integer.");
        }
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          throw new Error("This video does not have a seekable duration yet.");
        }
        // Seeking exactly to the duration can make YouTube replay from zero.
        const lastSecond = Math.max(0, Math.ceil(video.duration) - 1);
        const target = Math.min(seconds!, lastSecond);
        if (player.seekTo) player.seekTo(target, true);
        else video.currentTime = target;
        break;
      }
      case "play":
        if (player.playVideo) player.playVideo();
        else if (video.paused) {
          const button = player.querySelector<HTMLButtonElement>(".ytp-play-button");
          if (!button) throw new Error("The play control is unavailable for this video.");
          button.click();
        }
        break;
      case "pause":
        if (player.pauseVideo) player.pauseVideo();
        else video.pause();
        break;
      default: {
        const selectors = {
          mute: ".ytp-mute-button",
          autoplay: ".ytp-autonav-toggle-button",
          captions: ".ytp-subtitles-button",
          settings: ".ytp-settings-button",
          theater: ".ytp-size-button",
          fullscreen: ".ytp-fullscreen-button",
        };
        const button = player.querySelector<HTMLElement>(selectors[action]);
        if (
          !button ||
          button.hidden ||
          button.getAttribute("aria-disabled") === "true" ||
          button.hasAttribute("disabled") ||
          getComputedStyle(button).display === "none" ||
          getComputedStyle(button).visibility === "hidden"
        ) {
          throw new Error(`The ${action} control is unavailable for this video.`);
        }
        button.click();
      }
    }
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({ ok: false, error: (error as Error).message });
  }
}

export function buildYouTubeJavaScript(action: YouTubeAction, seconds?: string | number): string {
  if (
    ![
      "search",
      "seek",
      "play",
      "pause",
      "mute",
      "autoplay",
      "captions",
      "settings",
      "theater",
      "fullscreen",
    ].includes(action)
  ) {
    throw new Error(`Unknown YouTube action: ${action}`);
  }
  let target: number | undefined;
  if (action === "seek") {
    if (typeof seconds === "string" && !/^\d+$/.test(seconds)) {
      throw new Error("Seek time must be a non-negative safe integer.");
    }
    target = Number(seconds);
    if (!Number.isSafeInteger(target) || target < 0) {
      throw new Error("Seek time must be a non-negative safe integer.");
    }
  }
  return `(${runInPage.toString()})(${JSON.stringify(action)}, ${JSON.stringify(target) ?? "undefined"})`;
}
