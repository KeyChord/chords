import { Window } from "happy-dom";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { buildInstagramJavaScript, type InstagramAction } from "../src/js/page";

let window: Window;

beforeEach(() => {
  window = new Window({ url: "https://www.instagram.com/owner/" });
  window.document.body.innerHTML = `
    <nav>
      <a href="/"><svg aria-label="Home"></svg></a>
      <a href="/reels/"><svg aria-label="Reels"></svg></a>
      <a href="/direct/inbox/"><svg aria-label="Messages"></svg></a>
      <a href="/explore/"><svg aria-label="Search"></svg></a>
      <a href="#"><svg aria-label="New post"></svg>Create</a>
      <a href="/owner/">Profile</a>
    </nav>
    <main><header><section>
      <div role="button">Note...</div>
      <button title="Change profile photo"><img alt="Change profile photo" /></button>
    </section></header></main>`;
  // DOM fixtures have no layout engine. Give rendered elements a frame; hidden attributes
  // and CSS still exercise the page's visibility checks.
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    top: 0,
    left: 0,
    bottom: 40,
    right: 40,
    toJSON: () => ({}),
  });
  for (const link of window.document.querySelectorAll<HTMLAnchorElement>("nav a")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      if (link.getAttribute("href") !== "#") window.history.pushState(null, "", link.href);
    });
  }
});

afterEach(() => window.happyDOM.abort());

async function run(action: InstagramAction, storyNumber?: string | number) {
  return JSON.parse(await window.eval(buildInstagramJavaScript(action, storyNumber))) as {
    ok: boolean;
    error?: string;
  };
}

function storyTray(count = 12) {
  window.history.pushState(null, "", "/");
  const main = window.document.querySelector("main")!;
  main.innerHTML = `<div data-pagelet="story_tray"><ul>
    <li><button aria-label="Your story">Create story</button></li>
    ${Array.from(
      { length: count },
      (_, index) => `<li>
      <div role="button" aria-label="Story by account${index + 1}, ${index % 2 ? "seen" : "not seen"}">
        <span role="link"><img alt="account${index + 1}'s profile picture" /></span>
        account${index + 1}
      </div>
    </li>`,
    ).join("")}
    <li><button aria-label="Next">Next</button></li>
  </ul></div>
  <article><div role="button" aria-label="Story by feed-account, not seen">Feed avatar</div></article>`;
  const stories = [...main.querySelectorAll('[data-pagelet="story_tray"] [role="button"]')];
  const clicked = vi.fn();
  for (const [index, story] of stories.entries()) {
    story.addEventListener("click", () => {
      clicked(index + 1);
      window.history.pushState(null, "", `/stories/account${index + 1}/123/`);
    });
  }
  const unrelated = vi.fn();
  for (const control of main.querySelectorAll("button, article [role=button], [role=link]")) {
    control.addEventListener("click", unrelated);
  }
  return { stories, clicked, unrelated };
}

test.each([1, "2", "12", "01"])(
  "story %s is 1-based and uses only the Home tray",
  async (index) => {
    const { clicked, unrelated } = storyTray();
    expect(await run("story", index)).toEqual({ ok: true });
    expect(clicked).toHaveBeenCalledExactlyOnceWith(Number(index));
    expect(unrelated).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe(`/stories/account${Number(index)}/123/`);
  },
);

test("hidden and disabled story controls do not count toward the position", async () => {
  const { stories, clicked } = storyTray(3);
  stories[0].setAttribute("hidden", "");
  stories[1].setAttribute("aria-disabled", "true");
  expect(await run("story", "1")).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledExactlyOnceWith(3);
});

test("an unavailable story number never clicks another story", async () => {
  const { clicked, unrelated } = storyTray(2);
  expect((await run("story", "3")).error).toContain("Story #3 is unavailable");
  expect(clicked).not.toHaveBeenCalled();
  expect(unrelated).not.toHaveBeenCalled();
});

test("stories wait for the Home tray to load", async () => {
  window.history.pushState(null, "", "/");
  window.document.querySelector("main")!.innerHTML = "";
  setTimeout(() => storyTray(2), 10);
  expect(await run("story", 2)).toEqual({ ok: true });
  expect(window.location.pathname).toBe("/stories/account2/123/");
});

test("stories require Home and leave open dialogs untouched", async () => {
  const { clicked } = storyTray();
  window.history.pushState(null, "", "/owner/");
  expect((await run("story", 1)).error).toContain("Open Home");
  window.history.pushState(null, "", "/");
  const dialog = editor();
  expect((await run("story", 1)).error).toContain("Close the current dialog");
  expect(dialog.isConnected).toBe(true);
  expect(clicked).not.toHaveBeenCalled();
});

test("an empty story tray and a click that does not open a story report errors", async () => {
  let now = 0;
  vi.spyOn(window.Date, "now").mockImplementation(() => (now += 1000));
  storyTray(0);
  expect((await run("story", 1)).error).toContain("story tray is unavailable");
  storyTray(1);
  const story = window.document.querySelector('[aria-label^="Story by "]')!;
  story.replaceWith(story.cloneNode(true));
  expect((await run("story", 1)).error).toContain("did not open story #1");
});

test.each([undefined, "", "0", 0, -1, 1.5, "2x", "1e1", "1.0", Number.MAX_SAFE_INTEGER + 1])(
  "invalid story number %s fails before contacting the browser",
  (index) => {
    expect(() => buildInstagramJavaScript("story", index)).toThrow("positive safe integer");
  },
);

function editor() {
  const dialog = window.document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.innerHTML = `<h1>New note</h1>
    <div role="button"><svg aria-label="Close"></svg></div>
    <div role="textbox" contenteditable="true" aria-label="Share a thought..."></div>
    <button>Share</button><button>Delete note</button>`;
  dialog.querySelector('[role="button"]')!.addEventListener("click", () => dialog.remove());
  window.document.body.append(dialog);
  return dialog;
}

test.each([
  ["home", "/"],
  ["reels", "/reels/"],
  ["messages", "/direct/inbox/"],
  ["profile", "/owner/"],
] as const)("%s uses the actual navigation link", async (action, path) => {
  expect(await run(action)).toEqual({ ok: true });
  expect(window.location.pathname).toBe(path);
});

test("Search waits for the new page input, focuses it, and selects its existing query", async () => {
  const link = window.document.querySelector('a[href="/explore/"]')!;
  link.addEventListener("click", () =>
    setTimeout(() => {
      window.document.querySelector("main")!.innerHTML =
        '<input aria-label="Search input" placeholder="Search" value="existing query" />';
    }, 10),
  );
  expect(await run("search")).toEqual({ ok: true });
  const input = window.document.querySelector<HTMLInputElement>("input")!;
  expect(window.document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
  const clicked = vi.fn();
  link.addEventListener("click", clicked);
  expect(await run("search")).toEqual({ ok: true });
  expect(clicked).not.toHaveBeenCalled();
});

test("Search does not mistake the Messages search field for the navigation search", async () => {
  window.history.pushState(null, "", "/direct/inbox/");
  window.document.querySelector("main")!.innerHTML = '<input placeholder="Search" />';
  const link = window.document.querySelector('a[href="/explore/"]')!;
  const clicked = vi.fn();
  link.addEventListener("click", clicked);
  await run("search");
  expect(clicked).toHaveBeenCalledOnce();
  expect(window.location.pathname).toBe("/explore/");
});

test("Create handles the Post submenu and opens the composer without sharing", async () => {
  window.document.querySelector('a[href="#"]')!.addEventListener("click", () => {
    const post = window.document.createElement("a");
    post.href = "#";
    post.innerHTML = '<svg aria-label="Post"></svg>Post';
    post.addEventListener("click", (event) => {
      event.preventDefault();
      const dialog = window.document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.innerHTML =
        "<h1>Create new post</h1><button>Select from computer</button><button>Share</button>";
      window.document.body.append(dialog);
    });
    window.document.body.append(post);
  });
  expect(await run("create")).toEqual({ ok: true });
  expect(window.document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Create new post",
  );
});

test("Avatar clicks the current profile avatar, never the navigation avatar", async () => {
  const clicked = vi.fn();
  window.document
    .querySelector('button[title="Change profile photo"]')!
    .addEventListener("click", clicked);
  expect(await run("avatar")).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledOnce();
});

test("Notes opens the editor and repeated calls leave it open", async () => {
  const open = vi.fn(editor);
  window.document.querySelector('header [role="button"]')!.addEventListener("click", open);
  expect(await run("note")).toEqual({ ok: true });
  expect(await run("note")).toEqual({ ok: true });
  expect(open).toHaveBeenCalledOnce();
  expect(window.document.querySelector('[contenteditable="true"]')?.textContent).toBe("");
});

test("an existing note's bubble opens Leave a new note without deleting the old note", async () => {
  const bubble = window.document.querySelector('header [role="button"]')!;
  bubble.textContent = "My existing note";
  const remove = vi.fn();
  bubble.addEventListener("click", () => {
    const dialog = window.document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.innerHTML = "<button>Leave a new note</button><button>Delete note</button>";
    dialog.querySelector("button")!.addEventListener("click", () => {
      dialog.remove();
      editor();
    });
    dialog.querySelectorAll("button")[1].addEventListener("click", remove);
    window.document.body.append(dialog);
  });
  expect(await run("note")).toEqual({ ok: true });
  expect(remove).not.toHaveBeenCalled();
  expect(window.document.querySelector('[contenteditable="true"]')).not.toBeNull();
});

test("Close note only closes its editor and never shares or deletes", async () => {
  const dialog = editor();
  const share = vi.fn();
  const remove = vi.fn();
  dialog.querySelectorAll("button")[0].addEventListener("click", share);
  dialog.querySelectorAll("button")[1].addEventListener("click", remove);
  expect(await run("close-note")).toEqual({ ok: true });
  expect(dialog.isConnected).toBe(false);
  expect(await run("close-note")).toEqual({ ok: true });
  expect(share).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

test("Close note cannot close an unrelated Create dialog", async () => {
  const dialog = window.document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.innerHTML = '<h1>Create new post</h1><button aria-label="Close">Close</button>';
  window.document.body.append(dialog);
  const close = vi.fn();
  dialog.querySelector("button")!.addEventListener("click", close);
  expect((await run("close-note")).error).toContain("not an Instagram note editor");
  expect(close).not.toHaveBeenCalled();
});

test("unavailable Notes and avatar controls report a useful error", async () => {
  window.document.querySelector("header")!.remove();
  expect((await run("note")).error).toContain("Open your own profile");
  expect((await run("avatar")).error).toContain("Open a profile");
});

test.each(["https://example.com", "https://instagram.com.example.com"])(
  "rejects non-Instagram page %s",
  async (url) => {
    window.happyDOM.setURL(url);
    expect((await run("home")).error).toContain("not Instagram");
  },
);

test("unknown actions fail before contacting the browser", () => {
  expect(() => buildInstagramJavaScript("delete-note" as InstagramAction)).toThrow(
    "Unknown Instagram action",
  );
});
