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
