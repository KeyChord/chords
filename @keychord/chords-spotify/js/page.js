//#region src/js/now-playing.ts
function runInPage$1(action, seconds) {
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
  return `(${runInPage$1.toString()})(${JSON.stringify(action)}, ${JSON.stringify(target) ?? "undefined"})`;
}
//#endregion
//#region src/js/page.ts
async function runInPage(action, index) {
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
    function click(element, label) {
      if (
        !element ||
        !visible(element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      )
        throw new Error(`The ${label} action is unavailable for playlist track #${index}.`);
      element.click();
    }
    function waitFor(find, message) {
      const found = find();
      if (found !== void 0) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          const value = find();
          if (value !== void 0) {
            observer.disconnect();
            clearTimeout(timer);
            resolve(value);
          }
        });
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error(message));
        }, 1200);
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      });
    }
    const menus = () => [...document.querySelectorAll('[role="menu"]')].filter(visible);
    const items = (menu) =>
      [...menu.querySelectorAll('[role="menuitem"]')].filter(
        (item) => item.closest('[role="menu"]') === menu,
      );
    const label = (item) => item.textContent?.replace(/\s+/g, " ").trim();
    const list = document.querySelector(
      'main [data-testid="playlist-page"] [data-testid="track-list"]',
    );
    if (!list || !visible(list))
      throw new Error("Open a Spotify playlist before using playlist chords.");
    const row = [...list.querySelectorAll('[data-testid="tracklist-row"]')].find(
      (track) =>
        Number(track.closest('[role="row"][aria-rowindex]')?.getAttribute("aria-rowindex")) ===
        index + 1,
    );
    if (!row || !visible(row))
      throw new Error(`Playlist track #${index} is not loaded. Scroll it into view first.`);
    for (const menu of menus().reverse())
      menu.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
        }),
      );
    await waitFor(
      () => (menus().length === 0 ? true : void 0),
      "Could not dismiss the previous Spotify menu.",
    );
    row.scrollIntoView({ block: "nearest" });
    click(row.querySelector('[data-testid="more-button"]') ?? void 0, "More");
    const menu = await waitFor(
      () => menus().find((candidate) => items(candidate).length > 0),
      `Spotify did not open the menu for playlist track #${index}.`,
    );
    if (action === "more") return JSON.stringify({ ok: true });
    const wanted = {
      remove: [
        "Remove from this playlist",
        "Remove from playlist",
        ...(list.getAttribute("aria-label") === "Liked Songs"
          ? ["Remove from Liked Songs", "Remove from your Liked Songs"]
          : []),
      ],
      queue: ["Add to queue"],
      exclude: ["Exclude from your taste profile"],
      jam: ["Start a Jam"],
      "song-radio": ["Go to song radio"],
      artist: ["Go to artist"],
      album: ["Go to album"],
      credits: ["View credits"],
      "copy-link": ["Copy link to Song", "Copy song link"],
      embed: ["Embed track"],
    }[action];
    let scope = menu;
    if (action === "copy-link" || action === "embed") {
      const share = items(menu).find((item) => label(item) === "Share");
      if (
        !share ||
        !visible(share) ||
        share.hasAttribute("disabled") ||
        share.getAttribute("aria-disabled") === "true"
      )
        throw new Error(`The Share action is unavailable for playlist track #${index}.`);
      share.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      scope = await waitFor(
        () =>
          menus().find(
            (candidate) =>
              candidate !== menu &&
              items(candidate).some((item) => wanted.includes(label(item) ?? "")),
          ),
        `The ${wanted[0]} action is unavailable for playlist track #${index}.`,
      );
    }
    click(
      wanted.map((text) => items(scope).find((item) => label(item) === text)).find(Boolean),
      wanted[0],
    );
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error.message,
    });
  }
}
function buildSpotifyJavaScript(action, index) {
  if (action.startsWith("bar-")) return buildSpotifyBarJavaScript(action, index);
  if (
    ![
      "more",
      "remove",
      "queue",
      "exclude",
      "jam",
      "song-radio",
      "artist",
      "album",
      "credits",
      "copy-link",
      "embed",
    ].includes(action)
  )
    throw new Error(`Unknown Spotify action: ${action}`);
  if (typeof index === "string" && !/^\d+$/.test(index))
    throw new Error("Playlist track number must be a positive safe integer.");
  const target = Number(index);
  if (!Number.isSafeInteger(target) || target < 1)
    throw new Error("Playlist track number must be a positive safe integer.");
  return `(${runInPage.toString()})(${JSON.stringify(action)}, ${target})`;
}
//#endregion
export { buildSpotifyJavaScript };
