import { Window } from "happy-dom";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { buildYouTubeJavaScript, type YouTubeAction } from "../src/js/page";

let window: Window;
let video: ReturnType<Window["document"]["createElement"]>;
let player: ReturnType<Window["document"]["createElement"]> & {
  seekTo?: ReturnType<typeof mock>;
  playVideo?: ReturnType<typeof mock>;
  pauseVideo?: ReturnType<typeof mock>;
};

beforeEach(() => {
  window = new Window({ url: "https://www.youtube.com/watch?v=test" });
  window.document.body.innerHTML = `
    <input id="search" name="search_query" />
    <video id="preview"></video>
    <div id="movie_player">
      <video></video>
      <button class="ytp-play-button"></button>
      <button class="ytp-mute-button"></button>
      <button class="ytp-autonav-toggle-button" aria-checked="false"></button>
      <button class="ytp-subtitles-button" aria-pressed="false"></button>
      <button class="ytp-settings-button" aria-expanded="false"></button>
      <button class="ytp-size-button"></button>
      <button class="ytp-fullscreen-button"></button>
    </div>`;
  player = window.document.querySelector("#movie_player")!;
  video = player.querySelector("video")!;
  Object.defineProperty(video, "duration", { value: 120, configurable: true });
  player.seekTo = mock((seconds: number) => {
    video.currentTime = seconds;
  });
  player.playVideo = mock(() => {
    Object.defineProperty(video, "paused", { value: false, configurable: true });
  });
  player.pauseVideo = mock(() => {
    Object.defineProperty(video, "paused", { value: true, configurable: true });
  });
});

afterEach(() => window.happyDOM.abort());

function run(action: YouTubeAction, seconds?: string | number) {
  return JSON.parse(window.eval(buildYouTubeJavaScript(action, seconds))) as {
    ok: boolean;
    error?: string;
  };
}

test("seek uses absolute seconds and does not seek a preview video", () => {
  expect(run("SEEK", "30")).toEqual({ ok: true });
  expect(video.currentTime).toBe(30);
  expect(player.seekTo).toHaveBeenCalledWith(30, true);
  expect(window.document.querySelector<HTMLVideoElement>("#preview")!.currentTime).toBe(0);
});

test("seek clamps to the last playable whole second and supports zero", () => {
  run("SEEK", "999");
  expect(video.currentTime).toBe(119);
  run("SEEK", "0");
  expect(video.currentTime).toBe(0);
});

test("fractional video durations clamp to their last playable whole second", () => {
  Object.defineProperty(video, "duration", { value: 372.941 });
  run("SEEK", "999");
  expect(video.currentTime).toBe(372);
});

test("seek falls back to the media element when the player API is unavailable", () => {
  delete player.seekTo;
  expect(run("SEEK", "45").ok).toBe(true);
  expect(video.currentTime).toBe(45);
});

test.each([NaN, Infinity, 0, -1])(
  "does not seek a video with unavailable duration %s",
  (duration) => {
    Object.defineProperty(video, "duration", { value: duration });
    expect(run("SEEK", "30")).toEqual({
      ok: false,
      error: "This video does not have a seekable duration yet.",
    });
    expect(player.seekTo).not.toHaveBeenCalled();
  },
);

test.each([
  undefined,
  "",
  "-1",
  "1.5",
  "NaN",
  "1);alert(1)//",
  NaN,
  Infinity,
  -1,
  Number.MAX_SAFE_INTEGER + 1,
])("rejects invalid seek input %s before generating browser code", (input) => {
  expect(() => buildYouTubeJavaScript("SEEK", input)).toThrow("non-negative safe integer");
});

test("play and halt are idempotent and work while the search input has focus", () => {
  window.document.querySelector<HTMLInputElement>("#search")!.focus();
  run("PLAY");
  run("PLAY");
  expect(video.paused).toBe(false);
  run("PAUSE");
  run("PAUSE");
  expect(video.paused).toBe(true);
  expect(window.document.activeElement?.id).toBe("search");
});

test("the play fallback does not claim success when its control is missing", () => {
  delete player.playVideo;
  player.querySelector(".ytp-play-button")!.remove();
  expect(run("PLAY")).toEqual({
    ok: false,
    error: "The play control is unavailable for this video.",
  });
});

const toggles: [YouTubeAction, string][] = [
  ["MUTE", "ytp-mute-button"],
  ["AUTOPLAY", "ytp-autonav-toggle-button"],
  ["CAPTIONS", "ytp-subtitles-button"],
  ["SETTINGS", "ytp-settings-button"],
  ["THEATER", "ytp-size-button"],
  ["FULLSCREEN", "ytp-fullscreen-button"],
];

test.each(toggles)("%s toggles its player control both ways", (action, className) => {
  const button = player.querySelector(`.${className}`)!;
  let enabled = false;
  button.addEventListener("click", () => {
    enabled = !enabled;
  });
  expect(run(action)).toEqual({ ok: true });
  expect(enabled).toBe(true);
  run(action);
  expect(enabled).toBe(false);
});

test.each(["disabled", "aria-disabled", "hidden", "display", "visibility", "missing"])(
  "reports unavailable captions (%s) without claiming success",
  (unavailable) => {
    const button = player.querySelector<HTMLElement>(".ytp-subtitles-button")!;
    const click = spyOn(button, "click");
    switch (unavailable) {
      case "disabled":
        button.setAttribute("disabled", "");
        break;
      case "aria-disabled":
        button.setAttribute("aria-disabled", "true");
        break;
      case "hidden":
        button.hidden = true;
        break;
      case "display":
        button.style.display = "none";
        break;
      case "visibility":
        button.style.visibility = "hidden";
        break;
      case "missing":
        button.remove();
        break;
    }
    expect(run("CAPTIONS")).toEqual({
      ok: false,
      error: "The captions control is unavailable for this video.",
    });
    expect(click).not.toHaveBeenCalled();
  },
);

test("the home page reports that a video needs to be opened", () => {
  player.remove();
  expect(run("PLAY")).toEqual({
    ok: false,
    error: "Open a YouTube video before using video chords.",
  });
});

test("search focuses and selects the existing query without requiring a video", () => {
  player.remove();
  const input = window.document.querySelector<HTMLInputElement>("#search")!;
  input.value = "existing query";
  expect(run("SEARCH")).toEqual({ ok: true });
  expect(window.document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
});

test("an unrelated Brave tab is not modified", () => {
  window.location.href = "https://youtube.com.example.com/watch?v=test";
  expect(run("PLAY")).toEqual({ ok: false, error: "The active Brave window is not YouTube." });
  expect(player.playVideo).not.toHaveBeenCalled();
});

test("unknown actions fail before browser execution", () => {
  expect(() => buildYouTubeJavaScript("unknown" as YouTubeAction)).toThrow(
    "Unknown YouTube action",
  );
});
