//#region src/js/page.ts
function runInPage(action, seconds) {
  try {
    if (location.hostname !== "youtube.com" && !location.hostname.endsWith(".youtube.com"))
      throw new Error("The active Brave window is not YouTube.");
    if (action === "SEARCH") {
      const input = document.querySelector('input[name="search_query"]');
      if (!input) throw new Error("The YouTube search field is unavailable.");
      input.focus();
      input.select();
      return JSON.stringify({ ok: true });
    }
    const player = document.querySelector("#movie_player");
    const video = player?.querySelector("video");
    if (!player || !video) throw new Error("Open a YouTube video before using video chords.");
    switch (action) {
      case "SEEK": {
        if (!Number.isSafeInteger(seconds) || seconds < 0)
          throw new Error("Seek time must be a non-negative safe integer.");
        if (!Number.isFinite(video.duration) || video.duration <= 0)
          throw new Error("This video does not have a seekable duration yet.");
        const lastSecond = Math.max(0, Math.ceil(video.duration) - 1);
        const target = Math.min(seconds, lastSecond);
        if (player.seekTo) player.seekTo(target, true);
        else video.currentTime = target;
        break;
      }
      case "PLAY":
        if (player.playVideo) player.playVideo();
        else if (video.paused) {
          const button = player.querySelector(".ytp-play-button");
          if (!button) throw new Error("The play control is unavailable for this video.");
          button.click();
        }
        break;
      case "PAUSE":
        if (player.pauseVideo) player.pauseVideo();
        else video.pause();
        break;
      default: {
        const button = player.querySelector(
          {
            MUTE: ".ytp-mute-button",
            AUTOPLAY: ".ytp-autonav-toggle-button",
            CAPTIONS: ".ytp-subtitles-button",
            SETTINGS: ".ytp-settings-button",
            THEATER: ".ytp-size-button",
            FULLSCREEN: ".ytp-fullscreen-button",
          }[action],
        );
        if (
          !button ||
          button.hidden ||
          button.getAttribute("aria-disabled") === "true" ||
          button.hasAttribute("disabled") ||
          getComputedStyle(button).display === "none" ||
          getComputedStyle(button).visibility === "hidden"
        )
          throw new Error(`The ${action.toLowerCase()} control is unavailable for this video.`);
        button.click();
      }
    }
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error.message,
    });
  }
}
function buildYouTubeJavaScript(action, seconds) {
  if (
    ![
      "SEARCH",
      "SEEK",
      "PLAY",
      "PAUSE",
      "MUTE",
      "AUTOPLAY",
      "CAPTIONS",
      "SETTINGS",
      "THEATER",
      "FULLSCREEN",
    ].includes(action)
  )
    throw new Error(`Unknown YouTube action: ${action}`);
  let target;
  if (action === "SEEK") {
    if (typeof seconds === "string" && !/^\d+$/.test(seconds))
      throw new Error("Seek time must be a non-negative safe integer.");
    target = Number(seconds);
    if (!Number.isSafeInteger(target) || target < 0)
      throw new Error("Seek time must be a non-negative safe integer.");
  }
  return `(${runInPage.toString()})(${JSON.stringify(action)}, ${JSON.stringify(target) ?? "undefined"})`;
}
//#endregion
//#region src/js/youtube/cdp.ts
function youtubePageEndpoint(target, port) {
  if (
    target?.type !== "page" ||
    typeof target.url !== "string" ||
    typeof target.webSocketDebuggerUrl !== "string"
  )
    return;
  const page = URL.parse(target.url);
  if (
    !page ||
    page.protocol !== "https:" ||
    !(page.hostname === "youtube.com" || page.hostname.endsWith(".youtube.com"))
  )
    return;
  const socket = URL.parse(target.webSocketDebuggerUrl);
  if (
    socket?.protocol === "ws:" &&
    socket.hostname === "127.0.0.1" &&
    Number(socket.port || 80) === port &&
    !socket.username &&
    !socket.password &&
    socket.pathname.startsWith("/devtools/page/")
  )
    return socket.href;
}
function evaluate(endpoint, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const finish = (error, value) => {
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(/* @__PURE__ */ new Error("The YouTube app did not respond to the command.")),
      5e3,
    );
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression,
            returnByValue: true,
            awaitPromise: true,
            userGesture: true,
          },
        }),
      );
    socket.onerror = () =>
      finish(/* @__PURE__ */ new Error("Could not connect to the YouTube app."));
    socket.onclose = () =>
      finish(/* @__PURE__ */ new Error("The YouTube app closed before the command completed."));
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.id !== 1) return;
        const exception = message.result?.exceptionDetails;
        if (message.error || exception)
          finish(
            new Error(
              message.error?.message ?? exception?.exception?.description ?? exception?.text,
            ),
          );
        else finish(void 0, message.result?.result?.value);
      } catch (error) {
        finish(error);
      }
    };
  });
}
async function runYouTubeJavaScript(source, port, requireFocusedPage) {
  let pages;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2e3),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    pages = (await response.json()).flatMap((target) => {
      const endpoint = youtubePageEndpoint(target, port);
      return endpoint ? [endpoint] : [];
    });
  } catch (error) {
    throw new Error(
      `Start your browser with --remote-debugging-port=${port} before using YouTube chords. See the chords-youtube README for setup.`,
      { cause: error },
    );
  }
  if (pages.length === 0)
    throw new Error("Open the YouTube app or a YouTube tab before using these chords.");
  if (!requireFocusedPage && pages.length === 1) return evaluate(pages[0], source);
  const focused = (
    await Promise.all(
      pages.map(async (endpoint) => {
        try {
          return (await evaluate(endpoint, "document.hasFocus()")) === true ? endpoint : void 0;
        } catch {
          return;
        }
      }),
    )
  ).filter((endpoint) => endpoint !== void 0);
  if (focused.length !== 1)
    throw new Error("Focus the YouTube app or the web content in one YouTube tab.");
  if (!requireFocusedPage) return evaluate(focused[0], source);
  const guarded = `document.hasFocus() && location.protocol === "https:" &&
    (location.hostname === "youtube.com" || location.hostname.endsWith(".youtube.com"))
      ? (${source})
      : null`;
  const result = await evaluate(focused[0], guarded);
  if (result === null) throw new Error("YouTube lost focus before the command ran.");
  return result;
}
//#endregion
//#region src/js/youtube.ts
function buildHandler(port = 9222, requireFocusedPage = false) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("The YouTube debugging port must be an integer between 1 and 65535.");
  return async function handler(action, seconds) {
    const value = await runYouTubeJavaScript(
      buildYouTubeJavaScript(action, seconds),
      port,
      requireFocusedPage,
    );
    const result = JSON.parse(String(value));
    if (!result.ok) throw new Error(result.error ?? "YouTube action failed.");
    return true;
  };
}
//#endregion
export { buildHandler as default };
