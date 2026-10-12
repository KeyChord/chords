export type SpotifyTrackAction =
  | "more"
  | "remove"
  | "queue"
  | "exclude"
  | "jam"
  | "song-radio"
  | "artist"
  | "album"
  | "credits"
  | "copy-link"
  | "embed";

// Serialized into Spotify's renderer; keep every dependency inside this function.
async function runInPage(action: SpotifyTrackAction, index: number): Promise<string> {
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

    function click(element: HTMLElement | undefined, label: string): void {
      if (
        !element ||
        !visible(element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      ) {
        throw new Error(`The ${label} action is unavailable for playlist track #${index}.`);
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
            observer.disconnect();
            clearTimeout(timer);
            resolve(value);
          }
        });
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error(message));
        }, 1200);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      });
    }

    const menus = () =>
      [...document.querySelectorAll<HTMLElement>('[role="menu"]')].filter(visible);
    const items = (menu: HTMLElement) =>
      [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
        (item) => item.closest('[role="menu"]') === menu,
      );
    const label = (item: HTMLElement) => item.textContent?.replace(/\s+/g, " ").trim();

    const list = document.querySelector<HTMLElement>(
      'main [data-testid="playlist-page"] [data-testid="track-list"]',
    );
    if (!list || !visible(list)) {
      throw new Error("Open a Spotify playlist before using playlist chords.");
    }
    const row = [...list.querySelectorAll<HTMLElement>('[data-testid="tracklist-row"]')].find(
      // Spotify counts the column header as row 1, even when tracks are virtualized.
      (track) =>
        Number(track.closest('[role="row"][aria-rowindex]')?.getAttribute("aria-rowindex")) ===
        index + 1,
    );
    if (!row || !visible(row)) {
      throw new Error(`Playlist track #${index} is not loaded. Scroll it into view first.`);
    }

    // Dismiss any previous track's menu before opening this track's menu.
    for (const menu of menus().reverse()) {
      menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }
    await waitFor(
      () => (menus().length === 0 ? true : undefined),
      "Could not dismiss the previous Spotify menu.",
    );
    row.scrollIntoView({ block: "nearest" });
    click(row.querySelector<HTMLElement>('[data-testid="more-button"]') ?? undefined, "More");
    const menu = await waitFor(
      () => menus().find((candidate) => items(candidate).length > 0),
      `Spotify did not open the menu for playlist track #${index}.`,
    );
    if (action === "more") return JSON.stringify({ ok: true });

    const labels: Record<Exclude<SpotifyTrackAction, "more">, string[]> = {
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
    };
    const wanted = labels[action];
    let scope = menu;
    if (action === "copy-link" || action === "embed") {
      const share = items(menu).find((item) => label(item) === "Share");
      if (
        !share ||
        !visible(share) ||
        share.hasAttribute("disabled") ||
        share.getAttribute("aria-disabled") === "true"
      ) {
        throw new Error(`The Share action is unavailable for playlist track #${index}.`);
      }
      // Spotify opens submenus on hover, rather than on click.
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
    return JSON.stringify({ ok: false, error: (error as Error).message });
  }
}

export function buildSpotifyJavaScript(
  action: SpotifyTrackAction,
  index?: string | number,
): string {
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
  ) {
    throw new Error(`Unknown Spotify action: ${action}`);
  }
  if (typeof index === "string" && !/^\d+$/.test(index)) {
    throw new Error("Playlist track number must be a positive safe integer.");
  }
  const target = Number(index);
  if (!Number.isSafeInteger(target) || target < 1) {
    throw new Error("Playlist track number must be a positive safe integer.");
  }
  return `(${runInPage.toString()})(${JSON.stringify(action)}, ${target})`;
}
