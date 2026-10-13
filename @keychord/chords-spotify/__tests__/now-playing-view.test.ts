import { Window } from "happy-dom";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { buildSpotifyJavaScript } from "../src/js/page";
import type { SpotifyNowPlayingAction } from "../src/js/now-playing-view";

let window: Window;
let clicks: string[];
let state: "hidden" | "sidebar" | "expanded";
let commit: (next: typeof state) => void;
let stalled: boolean;
const views = [
  ["np-artwork", "artwork", "Show artwork"],
  ["np-canvas", "canvas", "Show Canvas"],
  ["np-artist-image", "hero", "Show artist image"],
  ["np-lyrics", "lyrics", "Show lyrics"],
] as const;

beforeEach(() => {
  window = new Window({ url: "https://xpui.app.spotify.com/index.html" });
  clicks = [];
  stalled = false;
  // Spotify keeps its sidebar mounted inside an aria-hidden ancestor when hidden.
  window.document.body.innerHTML = `
    <main><button aria-label="Enter Full screen"></button></main>
    <aside data-testid="now-playing-bar">
      <button data-testid="cover-art-button" aria-label="Now playing view"></button>
      <button data-testid="lyrics-button" aria-label="Lyrics"></button>
    </aside>
    <div id="sidebar-shell"><aside id="Desktop_PanelContainer_Id" aria-label="Now playing view">
      <button aria-label="Hide Now Playing view"></button>
      <button aria-label="Expand Now Playing view"></button>
    </aside></div>
    <button aria-label="Show Now Playing view"></button>
    <div id="expanded">
      <div role="radiogroup" aria-label="Media control options">
        ${views.map(([, value, label]) => `<button role="radio" value="${value}" aria-label="${label}" aria-checked="false"></button>`).join("")}
      </div>
      <button aria-label="Minimize Now Playing view"></button>
      <button aria-label="Enter Full screen"></button>
    </div>`;
  const button = (label: string) => window.document.querySelector(`button[aria-label="${label}"]`)!;
  commit = (next) => {
    state = next;
    window.document
      .querySelector("#sidebar-shell")!
      .setAttribute("aria-hidden", String(state !== "sidebar"));
    window.document.querySelector("#expanded")!.toggleAttribute("hidden", state !== "expanded");
    window.document
      .querySelector('button[aria-label="Show Now Playing view"]')
      ?.toggleAttribute("hidden", state !== "hidden");
  };
  function transition(label: string, next: () => typeof state) {
    clicks.push(label);
    const target = next();
    // Exercise waiting for React commits between actions.
    if (!stalled) window.setTimeout(() => commit(target), 5);
  }
  button("Show Now Playing view").addEventListener("click", () =>
    transition("show", () => "sidebar"),
  );
  button("Hide Now Playing view").addEventListener("click", () =>
    transition("hide", () => "hidden"),
  );
  button("Expand Now Playing view").addEventListener("click", () =>
    transition("expand", () => "expanded"),
  );
  button("Minimize Now Playing view").addEventListener("click", () =>
    transition("minimize", () => "sidebar"),
  );
  button("Now playing view").addEventListener("click", () =>
    // The real cover button minimizes an expanded view instead of hiding it.
    transition("cover", () => (state === "sidebar" ? "hidden" : "sidebar")),
  );
  for (const [, value, label] of views) {
    button(label).addEventListener("click", () => {
      clicks.push(value);
      if (!stalled) {
        window.setTimeout(() => {
          for (const radio of window.document.querySelectorAll('[role="radio"]')) {
            radio.setAttribute("aria-checked", String(radio.getAttribute("value") === value));
          }
        }, 5);
      }
    });
  }
  commit("sidebar");
});
afterEach(() => window.happyDOM.abort());

async function run(action: SpotifyNowPlayingAction): Promise<{ ok: boolean; error?: string }> {
  return JSON.parse(await window.eval(buildSpotifyJavaScript(action)));
}

test("Toggle hides and reveals the panel even though the hidden sidebar stays mounted", async () => {
  for (const expected of ["hidden", "sidebar", "hidden"]) {
    expect(await run("np-toggle")).toEqual({ ok: true });
    expect(state).toBe(expected);
  }
  expect(clicks).toEqual(["hide", "show", "hide"]);
});

test.each(["np-toggle", "np-hide"] as const)(
  "%s hides an expanded view completely",
  async (action) => {
    commit("expanded");
    expect(await run(action)).toEqual({ ok: true });
    expect(state).toBe("hidden");
    expect(clicks).toEqual(["minimize", "hide"]);
  },
);

test("Hide remains hidden when repeated", async () => {
  expect(await run("np-hide")).toEqual({ ok: true });
  expect(await run("np-hide")).toEqual({ ok: true });
  expect(state).toBe("hidden");
  expect(clicks).toEqual(["hide"]);
});

test("Expand reveals a hidden panel and keeps it expanded on repeated calls", async () => {
  commit("hidden");
  expect(await run("np-expand")).toEqual({ ok: true });
  expect(await run("np-expand")).toEqual({ ok: true });
  expect(state).toBe("expanded");
  expect(clicks).toEqual(["show", "expand"]);
});

test("Minimize keeps the sidebar open and leaves a hidden view hidden", async () => {
  commit("expanded");
  expect(await run("np-minimize")).toEqual({ ok: true });
  expect(state).toBe("sidebar");
  expect(await run("np-minimize")).toEqual({ ok: true });
  commit("hidden");
  expect(await run("np-minimize")).toEqual({ ok: true });
  expect(state).toBe("hidden");
  expect(clicks).toEqual(["minimize"]);
});

test.each(views)(
  "%s opens the expanded view, selects %s, and stays selected",
  async (action, value) => {
    commit("hidden");
    expect(await run(action)).toEqual({ ok: true });
    expect(state).toBe("expanded");
    expect(
      window.document.querySelector('[role="radio"][aria-checked="true"]')?.getAttribute("value"),
    ).toBe(value);
    expect(await run(action)).toEqual({ ok: true });
    expect(clicks).toEqual(["show", "expand", value]);
  },
);

test("a cover button supports versions without the edge Show / header Hide controls", async () => {
  window.document.querySelector('button[aria-label="Show Now Playing view"]')!.remove();
  window.document.querySelector('button[aria-label="Hide Now Playing view"]')!.remove();
  expect(await run("np-hide")).toEqual({ ok: true });
  expect(await run("np-expand")).toEqual({ ok: true });
  expect(state).toBe("expanded");
  expect(clicks).toEqual(["cover", "cover", "expand"]);
});

test.each(["disabled", "aria-disabled", "hidden", "missing"])(
  "an unavailable Canvas control reports an error without selecting another view (%s)",
  async (reason) => {
    commit("expanded");
    const radio = window.document.querySelector('[value="canvas"]')!;
    if (reason === "missing") radio.remove();
    else radio.setAttribute(reason, reason === "aria-disabled" ? "true" : "");
    expect((await run("np-canvas")).error).toContain("Canvas control is unavailable");
    expect(clicks).toEqual([]);
  },
);

test("hidden radio groups and unrelated lyrics controls cannot satisfy a view command", async () => {
  commit("expanded");
  window.document.querySelector('[role="radiogroup"]')!.setAttribute("aria-hidden", "true");
  expect((await run("np-lyrics")).error).toContain("Lyrics control is unavailable");
  expect(clicks).toEqual([]);
});

test("a missing Expand control never enters native full screen", async () => {
  window.document.querySelector('button[aria-label="Expand Now Playing view"]')!.remove();
  expect((await run("np-expand")).error).toContain("Expand control is unavailable");
  expect(clicks).toEqual([]);
});

test("a stalled expansion reports failure instead of success", async () => {
  stalled = true;
  expect(await run("np-expand")).toEqual({
    ok: false,
    error: "Spotify did not expand the Now Playing view.",
  });
  expect(clicks).toEqual(["expand"]);
});

test("a stalled view selection reports failure instead of success", async () => {
  commit("expanded");
  stalled = true;
  expect(await run("np-artwork")).toEqual({
    ok: false,
    error: "Spotify did not select Artwork in the Now Playing view.",
  });
});

test("unrelated renderers and unknown actions are rejected", async () => {
  window.happyDOM.setURL("https://open.spotify.com");
  expect((await run("np-toggle")).error).toBe("The selected page is not the Spotify desktop app.");
  expect(() => buildSpotifyJavaScript("np-unknown" as SpotifyNowPlayingAction)).toThrow(
    "Unknown Spotify action",
  );
  expect(clicks).toEqual([]);
});
