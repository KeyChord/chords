import { Window } from "happy-dom";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { buildSpotifyJavaScript, type SpotifyTrackAction } from "../src/js/page";

let window: Window;
let clicks: string[];
let opened: number[];
let menuDelay: number;
let shareDelay: number;
let omitted: string[];
const actions: [SpotifyTrackAction, string][] = [
  ["REMOVE", "Remove from this playlist"],
  ["QUEUE", "Add to queue"],
  ["EXCLUDE", "Exclude from your taste profile"],
  ["JAM", "Start a Jam"],
  ["SONG_RADIO", "Go to song radio"],
  ["ARTIST", "Go to artist"],
  ["ALBUM", "Go to album"],
  ["CREDITS", "View credits"],
  ["COPY_LINK", "Copy link to Song"],
  ["EMBED", "Embed track"],
];

function menu(index: number, submenu = false) {
  const root = window.document.createElement("ul");
  root.setAttribute("role", "menu");
  root.setAttribute("data-depth", submenu ? "1" : "0");
  const labels = actions
    .filter(([action]) => submenu === ["COPY_LINK", "EMBED"].includes(action))
    .map(([, label]) => label);
  if (!submenu)
    labels.push("Remove download", "Remove from queue", "Include in your taste profile", "Share");
  for (const label of labels.filter((label) => !omitted.includes(label))) {
    const item = window.document.createElement(
      ["Go to artist", "Go to album"].includes(label) ? "a" : "button",
    );
    item.setAttribute("role", "menuitem");
    item.textContent = label;
    item.addEventListener("click", () => {
      clicks.push(index + ":" + label);
    });
    if (label === "Share")
      item.addEventListener("mouseover", () => {
        const append = () => item.parentElement!.append(menu(index, true));
        if (shareDelay) window.setTimeout(append, shareDelay);
        else append();
      });
    const li = window.document.createElement("li");
    li.append(item);
    root.append(li);
  }
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      root.remove();
    }
  });
  return root;
}

beforeEach(() => {
  window = new Window({ url: "https://xpui.app.spotify.com/index.html" });
  clicks = [];
  opened = [];
  omitted = [];
  menuDelay = shareDelay = 0;
  // The sidebar has its own rows; the main grid includes a header and virtualized track rows.
  window.document.body.innerHTML =
    '<aside><div role="row" aria-rowindex="2"><button data-testid="more-button"></button></div></aside><main><section data-testid="playlist-page"><div role="grid" data-testid="track-list"><div role="row" aria-rowindex="1"><div role="columnheader">#</div></div></div></section></main>';
  const list = window.document.querySelector('[data-testid="track-list"]')!;
  for (const index of [5, 6]) {
    const outer = window.document.createElement("div");
    outer.setAttribute("role", "row");
    outer.setAttribute("aria-rowindex", String(index + 1));
    outer.innerHTML =
      '<div role="presentation" data-testid="tracklist-row"><div role="gridcell" aria-colindex="1">' +
      index +
      '</div><button data-testid="more-button">More</button></div>';
    outer.querySelector('[data-testid="more-button"]')!.addEventListener("click", () => {
      opened.push(index);
      const append = () => window.document.body.append(menu(index));
      if (menuDelay) window.setTimeout(append, menuDelay);
      else append();
    });
    list.append(outer);
  }
});
afterEach(() => window.happyDOM.abort());

async function run(action: SpotifyTrackAction, index: string | number = "5") {
  return JSON.parse(await window.eval(buildSpotifyJavaScript(action, index))) as {
    ok: boolean;
    error?: string;
  };
}

test("More opens the numbered track menu without performing any menu action", async () => {
  expect(await run("MORE")).toEqual({ ok: true });
  expect(opened).toEqual([5]);
  expect(clicks).toEqual([]);
  expect(window.document.querySelector('[role="menu"]')).not.toBeNull();
});

test.each(actions)("%s acts only on the numbered playlist track", async (action, label) => {
  expect(await run(action, "6")).toEqual({ ok: true });
  expect(opened).toEqual([6]);
  expect(clicks).toEqual(["6:" + label]);
});

test("virtualized rows use absolute playlist numbers, rather than their DOM position", async () => {
  expect(await run("MORE", "1")).toEqual({
    ok: false,
    error: "Playlist track #1 is not loaded. Scroll it into view first.",
  });
  expect(opened).toEqual([]);
});

test("the sidebar and recommendations cannot satisfy a missing playlist row", async () => {
  const recommendation = window.document.createElement("div");
  recommendation.innerHTML =
    '<div role="row" aria-rowindex="2"><div data-testid="tracklist-row"><button data-testid="more-button"></button></div></div>';
  window.document.querySelector("main")!.append(recommendation);
  expect((await run("REMOVE", "1")).ok).toBe(false);
  expect(clicks).toEqual([]);
  expect(opened).toEqual([]);
});

test.each(["main", '[data-testid="playlist-page"]', '[data-testid="track-list"]'])(
  "requires the playlist screen (%s missing)",
  async (selector) => {
    window.document.querySelector(selector)!.remove();
    expect(await run("MORE")).toEqual({
      ok: false,
      error: "Open a Spotify playlist before using playlist chords.",
    });
    expect(opened).toEqual([]);
  },
);

test("a hidden playlist is not modified", async () => {
  window.document.querySelector<HTMLElement>("main")!.style.display = "none";
  expect((await run("MORE")).ok).toBe(false);
  expect(opened).toEqual([]);
});

test.each([
  undefined,
  "",
  "0",
  "-1",
  "1.5",
  " 5 ",
  "5);alert(1)//",
  NaN,
  Infinity,
  -1,
  0,
  Number.MAX_SAFE_INTEGER + 1,
])("rejects invalid track number %s before generating page code", (index) => {
  expect(() => buildSpotifyJavaScript("REMOVE", index)).toThrow("positive safe integer");
});

test("unknown actions fail before generating page code", () => {
  expect(() => buildSpotifyJavaScript("unknown" as SpotifyTrackAction, "5")).toThrow(
    "Unknown Spotify action",
  );
});

test.each([
  "https://open.spotify.com",
  "https://xpui.app.spotify.com.example.com",
  "https://example.com",
])("unrelated pages are not modified (%s)", async (url) => {
  window.location.href = url;
  expect(await run("REMOVE")).toEqual({
    ok: false,
    error: "The selected page is not the Spotify desktop app.",
  });
  expect(opened).toEqual([]);
});

test("a previous track menu is dismissed before acting on another track", async () => {
  window.document.body.append(menu(99));
  expect(await run("QUEUE", "5")).toEqual({ ok: true });
  expect(clicks).toEqual(["5:Add to queue"]);
  expect(window.document.querySelectorAll('[role="menu"]')).toHaveLength(1);
});

test("a previous Share submenu is dismissed along with its root menu", async () => {
  await run("COPY_LINK", "5");
  clicks.length = 0;
  expect(await run("QUEUE", "6")).toEqual({ ok: true });
  expect(clicks).toEqual(["6:Add to queue"]);
  expect(window.document.querySelectorAll('[role="menu"]')).toHaveLength(1);
});

test("menus that cannot be dismissed prevent acting on another track", async () => {
  const stuck = window.document.createElement("ul");
  stuck.setAttribute("role", "menu");
  window.document.body.append(stuck);
  expect(await run("REMOVE")).toEqual({
    ok: false,
    error: "Could not dismiss the previous Spotify menu.",
  });
  expect(opened).toEqual([]);
});

test("asynchronously rendered track and Share menus are awaited", async () => {
  menuDelay = shareDelay = 20;
  expect(await run("EMBED")).toEqual({ ok: true });
  expect(clicks).toEqual(["5:Embed track"]);
});

test("a menu that never opens reports failure", async () => {
  const button = window.document.querySelector(
    '[data-testid="tracklist-row"] [data-testid="more-button"]',
  )!;
  button.replaceWith(button.cloneNode(true));
  expect(await run("QUEUE")).toEqual({
    ok: false,
    error: "Spotify did not open the menu for playlist track #5.",
  });
  expect(clicks).toEqual([]);
});

test.each(["disabled", "aria-disabled", "hidden", "display", "visibility", "missing"])(
  "unavailable More control reports failure (%s)",
  async (unavailable) => {
    const button = window.document.querySelector<HTMLElement>(
      '[data-testid="tracklist-row"] [data-testid="more-button"]',
    )!;
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
    expect(await run("MORE")).toEqual({
      ok: false,
      error: "The More action is unavailable for playlist track #5.",
    });
    expect(opened).toEqual([]);
  },
);

test.each(actions)("missing %s never clicks another menu item", async (action, label) => {
  omitted = [label];
  expect((await run(action)).ok).toBe(false);
  expect(clicks).toEqual([]);
});

test("an unavailable Share parent fails without clicking a root action", async () => {
  omitted = ["Share"];
  expect(await run("COPY_LINK")).toEqual({
    ok: false,
    error: "The Share action is unavailable for playlist track #5.",
  });
  expect(clicks).toEqual([]);
});

test.each(["Remove from Liked Songs", "Remove from your Liked Songs", "Remove from playlist"])(
  "Remove supports Spotify's label %s",
  async (label) => {
    if (label.includes("Liked Songs")) {
      window.document
        .querySelector('[data-testid="track-list"]')!
        .setAttribute("aria-label", "Liked Songs");
    }
    const button = window.document.querySelector(
      '[data-testid="tracklist-row"] [data-testid="more-button"]',
    )!;
    button.addEventListener("click", () => {
      [...window.document.querySelectorAll('[role="menuitem"]')].find(
        (item) => item.textContent === "Remove from this playlist",
      )!.textContent = label;
    });
    expect(await run("REMOVE")).toEqual({ ok: true });
    expect(clicks).toEqual(["5:Remove from this playlist"]);
  },
);

test("disabled menu actions do not report success", async () => {
  const button = window.document.querySelector(
    '[data-testid="tracklist-row"] [data-testid="more-button"]',
  )!;
  button.addEventListener("click", () => {
    [...window.document.querySelectorAll('[role="menuitem"]')]
      .find((item) => item.textContent === "Add to queue")!
      .setAttribute("aria-disabled", "true");
  });
  expect(await run("QUEUE")).toEqual({
    ok: false,
    error: "The Add to queue action is unavailable for playlist track #5.",
  });
  expect(clicks).toEqual([]);
});

test("Remove prefers the current playlist even when unlike appears first in the menu", async () => {
  const button = window.document.querySelector(
    '[data-testid="tracklist-row"] [data-testid="more-button"]',
  )!;
  button.addEventListener("click", () => {
    const root = window.document.querySelector('[role="menu"]')!;
    const unlike = window.document.createElement("button");
    unlike.setAttribute("role", "menuitem");
    unlike.textContent = "Remove from Liked Songs";
    unlike.addEventListener("click", () => clicks.push("unliked"));
    root.prepend(unlike);
  });
  expect(await run("REMOVE")).toEqual({ ok: true });
  expect(clicks).toEqual(["5:Remove from this playlist"]);
});

test("a playlist without removal permission does not fall back to unliking the track", async () => {
  const button = window.document.querySelector(
    '[data-testid="tracklist-row"] [data-testid="more-button"]',
  )!;
  button.addEventListener("click", () => {
    [...window.document.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.textContent === "Remove from this playlist",
    )!.textContent = "Remove from Liked Songs";
  });
  expect((await run("REMOVE")).ok).toBe(false);
  expect(clicks).toEqual([]);
});

test.each(["disabled", "aria-disabled", "hidden"])(
  "an unavailable Share parent rejects (%s)",
  async (attribute) => {
    const button = window.document.querySelector(
      '[data-testid="tracklist-row"] [data-testid="more-button"]',
    )!;
    button.addEventListener("click", () => {
      [...window.document.querySelectorAll('[role="menuitem"]')]
        .find((item) => item.textContent === "Share")!
        .setAttribute(attribute, attribute === "aria-disabled" ? "true" : "");
    });
    expect((await run("EMBED")).ok).toBe(false);
    expect(clicks).toEqual([]);
  },
);
