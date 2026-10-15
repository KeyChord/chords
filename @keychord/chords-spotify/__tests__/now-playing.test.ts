import { Window } from "happy-dom";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { buildSpotifyJavaScript } from "../src/js/page";
import type { SpotifyBarAction } from "../src/js/now-playing";

let window: Window;
let clicks: string[];
let seeks: number[];
const controls: [SpotifyBarAction, string, string][] = [
  ["BAR_PREVIOUS", "control-button-skip-back", "Previous"],
  ["BAR_NEXT", "control-button-skip-forward", "Next"],
  ["BAR_REPEAT", "control-button-repeat", "Enable repeat"],
  ["BAR_LYRICS", "lyrics-button", "Lyrics"],
  ["BAR_QUEUE", "control-button-queue", "Queue"],
  ["BAR_CONNECT", "", "Connect to a device"],
  ["BAR_MINIPLAYER", "pip-toggle-button", "Open Miniplayer"],
  ["BAR_FULLSCREEN", "fullscreen-mode-button", "Enter Full screen"],
  ["BAR_SHUFFLE", "", "Enable Shuffle for Ninajirachi Popular"],
];

beforeEach(() => {
  window = new Window({ url: "https://xpui.app.spotify.com/index.html" });
  clicks = [];
  seeks = [];
  window.document.body.innerHTML =
    '<main><button aria-label="Play">Playlist play</button></main>' +
    '<aside data-testid="now-playing-bar"><button data-testid="control-button-playpause" aria-label="Play"></button>' +
    '<div data-testid="playback-progressbar"><label>Change progress<input type="range" min="0" max="231000" step="5000" value="30000"></label>' +
    '<div data-testid="progress-bar"></div></div>' +
    '<div data-testid="volume-bar"><input type="range" max="1" step="0.1" value="1"></div></aside>';
  window.document
    .querySelector("main button")!
    .addEventListener("click", () => clicks.push("playlist"));
  const bar = window.document.querySelector('[data-testid="now-playing-bar"]')!;
  for (const [action, testid, label] of controls) {
    const button = window.document.createElement("button");
    if (testid) button.setAttribute("data-testid", testid);
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => clicks.push(action));
    bar.append(button);
  }
  const play = window.document.querySelector('[data-testid="control-button-playpause"]')!;
  play.addEventListener("click", () => {
    clicks.push(play.getAttribute("aria-label")!);
    play.setAttribute("aria-label", play.getAttribute("aria-label") === "Play" ? "Pause" : "Play");
  });
  const slider = window.document.querySelector(
    '[data-testid="playback-progressbar"] [data-testid="progress-bar"]',
  )!;
  Object.assign(slider, {
    getBoundingClientRect: () => ({ left: 100, top: 20, width: 462, height: 8 }),
  });
  // Spotify commits a seek on pointer release, using its progress bar's bounds.
  slider.addEventListener("pointerdown", () => {
    window.document.addEventListener(
      "pointerup",
      (event) => {
        const rtl = window.getComputedStyle(slider).direction === "rtl";
        const ratio = (event.clientX - 100) / 462;
        seeks.push(((rtl ? 1 - ratio : ratio) * 231000) / 1000);
      },
      { once: true },
    );
  });
});
afterEach(() => window.happyDOM.abort());

function run(action: SpotifyBarAction, seconds?: string | number) {
  return JSON.parse(window.eval(buildSpotifyJavaScript(action, seconds))) as {
    ok: boolean;
    error?: string;
  };
}

test.each(controls)("%s clicks its Now Playing control without needing a playlist", (action) => {
  expect(run(action)).toEqual({ ok: true });
  expect(clicks).toEqual([action]);
});

test("Play and Halt request explicit states, including repeated invocations", () => {
  for (const action of ["BAR_PLAY", "BAR_PLAY", "BAR_HALT", "BAR_HALT"] as const) {
    expect(run(action)).toEqual({ ok: true });
  }
  expect(clicks).toEqual(["Play", "Pause"]);
});

test("an unknown playback state fails without toggling", () => {
  window.document
    .querySelector('[data-testid="control-button-playpause"]')!
    .setAttribute("aria-label", "Loading");
  expect(run("BAR_PLAY").error).toContain("determine Spotify's playback state");
  expect(clicks).toEqual([]);
});

test.each([
  ["BAR_SHUFFLE", "Disable Shuffle"],
  ["BAR_MINIPLAYER", "Close Miniplayer"],
  ["BAR_FULLSCREEN", "Exit full screen"],
] as const)("%s supports the control's enabled label", (action, label) => {
  const control = controls.find(([candidate]) => candidate === action)!;
  window.document
    .querySelector(`button[aria-label="${control[2]}"]`)!
    .setAttribute("aria-label", label);
  expect(run(action)).toEqual({ ok: true });
  expect(clicks).toEqual([action]);
});

test.each(["disabled", "aria-disabled", "hidden", "display", "visibility", "missing"])(
  "an unavailable control fails without clicking another button (%s)",
  (reason) => {
    const button = window.document.querySelector('[data-testid="control-button-skip-forward"]')!;
    switch (reason) {
      case "display":
        button.setAttribute("style", "display: none");
        break;
      case "visibility":
        button.setAttribute("style", "visibility: hidden");
        break;
      case "missing":
        button.remove();
        break;
      default:
        button.setAttribute(reason, reason === "aria-disabled" ? "true" : "");
    }
    expect(run("BAR_NEXT").error).toContain("Next control is unavailable");
    expect(clicks).toEqual([]);
  },
);

test("controls outside a hidden Now Playing bar cannot satisfy a bar command", () => {
  window.document.querySelector('[data-testid="now-playing-bar"]')!.setAttribute("hidden", "");
  expect(run("BAR_PLAY").error).toContain("Now Playing bar is unavailable");
  expect(clicks).toEqual([]);
});

test("a missing bar does not use a playlist's play button", () => {
  window.document.querySelector('[data-testid="now-playing-bar"]')!.remove();
  expect(run("BAR_PLAY").ok).toBe(false);
  expect(clicks).toEqual([]);
});

test.each([
  "https://open.spotify.com",
  "https://example.com",
  "https://xpui.app.spotify.com.example.com",
])("unrelated renderers are not modified (%s)", (url) => {
  window.location.href = url;
  expect(run("BAR_NEXT").error).toBe("The selected page is not the Spotify desktop app.");
  expect(clicks).toEqual([]);
});

test.each([
  ["0", 0],
  ["37", 37],
  ["999", 230],
])("Scrub %s seeks to an exact second, clamping beyond the track's end", (seconds, target) => {
  expect(run("BAR_SCRUB", seconds)).toEqual({ ok: true });
  expect(seeks).toHaveLength(1);
  expect(seeks[0]).toBeCloseTo(target as number);
  expect(
    window.document.querySelector<HTMLInputElement>('[data-testid="volume-bar"] input')!.value,
  ).toBe("1");
});

test("Scrub respects a right-to-left progress bar", () => {
  window.document
    .querySelector('[data-testid="playback-progressbar"] [data-testid="progress-bar"]')!
    .setAttribute("style", "direction: rtl");
  expect(run("BAR_SCRUB", 37)).toEqual({ ok: true });
  expect(seeks[0]).toBeCloseTo(37);
});

test.each(["0", "", "NaN", "Infinity"])("Scrub rejects an unseekable duration %s", (max) => {
  window.document
    .querySelector('[data-testid="playback-progressbar"] input')!
    .setAttribute("max", max);
  expect(run("BAR_SCRUB", 37).ok).toBe(false);
  expect(seeks).toEqual([]);
});

test("Scrub fails if the progress control is disabled", () => {
  window.document
    .querySelector('[data-testid="playback-progressbar"] input')!
    .setAttribute("disabled", "");
  expect(run("BAR_SCRUB", 37).error).toContain("Scrub control is unavailable");
  expect(seeks).toEqual([]);
});

test("Scrub fails if the progress bar has no visible geometry", () => {
  const slider = window.document.querySelector(
    '[data-testid="playback-progressbar"] [data-testid="progress-bar"]',
  )!;
  Object.assign(slider, { getBoundingClientRect: () => ({ width: 0, height: 0 }) });
  expect(run("BAR_SCRUB", 37).error).toContain("progress bar is not visible");
  expect(seeks).toEqual([]);
});

test.each([
  undefined,
  "",
  "-1",
  "1.5",
  " 37 ",
  "37);alert(1)//",
  NaN,
  Infinity,
  -1,
  Number.MAX_SAFE_INTEGER + 1,
])("invalid scrub input %s fails before generating page code", (seconds) => {
  expect(() => buildSpotifyJavaScript("BAR_SCRUB", seconds)).toThrow("non-negative safe integer");
});

test("unknown bar commands fail before generating page code", () => {
  expect(() => buildSpotifyJavaScript("bar-unknown" as SpotifyBarAction)).toThrow(
    "Unknown Spotify action",
  );
});
