export type SpotifyNavigationAction = "liked-songs";

// Serialized into Spotify's renderer; keep every dependency inside this function.
async function gotoLikedSongs(): Promise<string> {
  try {
    if (location.hostname !== "xpui.app.spotify.com") {
      throw new Error("The selected page is not the Spotify desktop app.");
    }

    type Location = {
      pathname: string;
      search: string;
      hash: string;
      state?: unknown;
      key: string;
    };
    type Navigator = { location: Location; replace: (path: string, state: object) => void };
    type Fiber = {
      child?: Fiber;
      sibling?: Fiber;
      stateNode?: { current?: Fiber };
      memoizedProps?: { value?: { navigator?: Navigator; location?: Location } };
    };

    function* values(container: Fiber) {
      // React keeps the committed tree on current; the attached fiber can be stale.
      const stack = [container.stateNode?.current ?? container];
      while (stack.length) {
        const fiber = stack.pop()!;
        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
        if (fiber.memoizedProps?.value) yield fiber.memoizedProps.value;
      }
    }

    let container: Fiber | undefined;
    let navigator: Navigator | undefined;
    // Discover the app's router by its API, without depending on the current screen,
    // translated labels, minified component names, or webpack module numbers.
    for (const element of document.querySelectorAll("*")) {
      const key = Object.keys(element).find((name) => name.startsWith("__reactContainer$"));
      if (!key) continue;
      const root = (element as unknown as Record<string, Fiber>)[key];
      for (const value of values(root)) {
        const candidate = value.navigator;
        if (typeof candidate?.replace === "function" && candidate.location?.pathname) {
          container = root;
          navigator = candidate;
          break;
        }
      }
      if (navigator) break;
    }
    if (!navigator || !container) {
      throw new Error("Spotify's navigation API is unavailable. Open the main Spotify window.");
    }

    const previousKey = navigator.location.key;
    // Spotify suppresses same-URL pushes. Replace also clears inherited view state,
    // so navigation works even when another view covers this same underlying route.
    navigator.replace("/collection/tracks", {});
    const destination = navigator.location;
    if (
      destination.pathname !== "/collection/tracks" ||
      destination.search ||
      destination.hash ||
      Object.keys(destination.state ?? {}).length ||
      destination.key === previousKey
    ) {
      throw new Error("Spotify did not navigate to Liked Songs.");
    }

    // Wait for the new location to commit and the playlist to render before allowing
    // the next chord to operate on tracks from the destination.
    const deadline = Date.now() + 3000;
    do {
      const committed = [...values(container)].some(
        (value) => value.location?.key === destination.key,
      );
      const playlist = document.querySelector('main [data-testid="playlist-page"]');
      if (committed && playlist) return JSON.stringify({ ok: true });
      await new Promise((resolve) => setTimeout(resolve, 40));
    } while (Date.now() < deadline);
    throw new Error("Spotify did not finish opening Liked Songs.");
  } catch (error) {
    return JSON.stringify({ ok: false, error: (error as Error).message });
  }
}

export function buildSpotifyNavigationJavaScript(): string {
  return `(${gotoLikedSongs.toString()})()`;
}
