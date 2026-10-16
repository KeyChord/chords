import { Window } from "happy-dom";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { buildSpotifyJavaScript } from "../src/js/page";

let window: Window;
beforeEach(() => {
  window = new Window({ url: "https://xpui.app.spotify.com/index.html" });
});
afterEach(() => window.happyDOM.abort());

function router(pathname: string, state: object = {}) {
  window.document.body.innerHTML = "<div><main><h1>Current screen</h1></main></div>";
  const element = window.document.body.firstElementChild!;
  const location = { pathname, search: "?old-search", hash: "#old-anchor", state, key: "old" };
  const history = {
    location,
    replace: vi.fn((path: string, newState: object) => {
      history.location = { pathname: path, search: "", hash: "", state: newState, key: "new" };
      commit();
    }),
    // Reproduce Spotify's guard: it ignores a push to the same URL even if state differs.
    push: vi.fn(),
  };
  const committed = { memoizedProps: { value: { location } } };
  const current = { memoizedProps: { value: { navigator: history } }, child: committed };
  const container = {
    // The attached fiber's props are stale; production must use stateNode.current.
    memoizedProps: { value: { navigator: { replace: vi.fn(), location } } },
    stateNode: { current },
  };
  Object.assign(element, { __reactContainer$randomSuffix: container });
  let paint = true;
  function commit() {
    if (!paint) return;
    committed.memoizedProps.value.location = history.location;
    window.document.querySelector("main")!.innerHTML =
      '<section data-testid="playlist-page"><h1>Liked Songs</h1></section>';
  }
  return {
    history,
    container,
    deferPaint: () => (paint = false),
    finishPaint: () => {
      paint = true;
      commit();
    },
  };
}

async function run(): Promise<{ ok: boolean; error?: string }> {
  return JSON.parse(await window.eval(buildSpotifyJavaScript("LIKED_SONGS")));
}

test.each([
  ["/", {}],
  ["/search/query", {}],
  ["/artist/artist", {}],
  ["/album/album", {}],
  ["/playlist/playlist", {}],
  ["/collection/tracks", {}],
  ["/collection/tracks", { cinemaState: "nowPlayingView" }],
  ["/collection/tracks", { arbitraryFutureView: { expanded: true } }],
])("Liked Songs replaces %s with fresh view state (%j)", async (path, state) => {
  const { history, container } = router(path, state);
  expect(await run()).toEqual({ ok: true });
  expect(history.location).toEqual({
    pathname: "/collection/tracks",
    search: "",
    hash: "",
    state: {},
    key: "new",
  });
  expect(history.push).not.toHaveBeenCalled();
  expect(container.memoizedProps.value.navigator.replace).not.toHaveBeenCalled();
  expect(window.document.querySelector("h1")!.textContent).toBe("Liked Songs");
});

test("navigation waits for the committed destination and playlist to render", async () => {
  const { deferPaint, finishPaint } = router("/playlist/other");
  deferPaint();
  // An old playlist must not be mistaken for the destination before location commits.
  window.document.querySelector("main")!.innerHTML =
    '<section data-testid="playlist-page"></section>';
  let finished = false;
  const pending = run().then((result) => {
    finished = true;
    return result;
  });
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(finished).toBe(false);
  finishPaint();
  expect(await pending).toEqual({ ok: true });
});

test("a blocked navigation reports failure even if Liked Songs is behind the active view", async () => {
  const { history } = router("/collection/tracks", { cinemaState: "nowPlayingView" });
  history.replace.mockImplementation(() => {});
  window.document.querySelector("main")!.innerHTML =
    '<section data-testid="playlist-page"></section>';
  expect(await run()).toEqual({ ok: false, error: "Spotify did not navigate to Liked Songs." });
});

test("a destination that never renders reports a timeout", async () => {
  const { deferPaint } = router("/");
  deferPaint();
  expect(await run()).toEqual({ ok: false, error: "Spotify did not finish opening Liked Songs." });
});

test("a missing router reports an error without using browser navigation", async () => {
  expect(await run()).toEqual({
    ok: false,
    error: "Spotify's navigation API is unavailable. Open the main Spotify window.",
  });
  expect(window.location.href).toBe("https://xpui.app.spotify.com/index.html");
});

test("an unrelated page is rejected", async () => {
  window.happyDOM.setURL("https://example.com");
  expect(await run()).toEqual({
    ok: false,
    error: "The selected page is not the Spotify desktop app.",
  });
});
