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
  window.Element.prototype.getBoundingClientRect = () => ({
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
    expect(await run("STORY", index)).toEqual({ ok: true });
    expect(clicked).toHaveBeenCalledExactlyOnceWith(Number(index));
    expect(unrelated).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe(`/stories/account${Number(index)}/123/`);
  },
);

test("hidden and disabled story controls do not count toward the position", async () => {
  const { stories, clicked } = storyTray(3);
  stories[0].setAttribute("hidden", "");
  stories[1].setAttribute("aria-disabled", "true");
  expect(await run("STORY", "1")).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledExactlyOnceWith(3);
});

test.each([
  '<textarea placeholder="Reply to account2..."></textarea>',
  '<input placeholder="Send message" />',
  '<div contenteditable="true" role="textbox" aria-label="Reply to account2..."></div>',
])("story reply opens the selected story and focuses its editor: %s", async (markup) => {
  const { stories, clicked } = storyTray(2);
  const sent = vi.fn();
  stories[1].addEventListener("click", () =>
    setTimeout(() => {
      window.document.querySelector("main")!.innerHTML = `${markup}<button>Send</button>`;
      window.document.querySelector("button")!.addEventListener("click", sent);
    }, 10),
  );
  expect(await run("STORY_REPLY", 2)).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledExactlyOnceWith(2);
  const input = window.document.querySelector('textarea, input, [contenteditable="true"]')!;
  expect(window.document.activeElement).toBe(input);
  expect(input.textContent).toBe("");
  expect(sent).not.toHaveBeenCalled();
});

test("story replies handle Instagram replacing the collapsed editor", async () => {
  const { stories } = storyTray(1);
  stories[0].addEventListener("click", () => {
    const input = window.document.createElement("textarea");
    input.placeholder = "Reply to account1...";
    input.addEventListener("click", () => {
      const expanded = input.cloneNode(true);
      input.replaceWith(expanded);
    });
    window.document.querySelector("main")!.replaceChildren(input);
  });
  expect(await run("STORY_REPLY", 1)).toEqual({ ok: true });
  expect(window.document.activeElement).toBe(window.document.querySelector("textarea"));
});

test.each(["hidden", "disabled", "readonly"])(
  "unavailable story replies (%s) report an error",
  async (attribute) => {
    let now = 0;
    vi.spyOn(window.Date, "now").mockImplementation(() => (now += 1000));
    const { stories } = storyTray(1);
    stories[0].addEventListener("click", () => {
      window.document.querySelector("main")!.innerHTML =
        `<textarea placeholder="Reply to account1..." ${attribute}></textarea><textarea placeholder="Add a comment..."></textarea>`;
    });
    expect((await run("STORY_REPLY", 1)).error).toContain("Replies may be disabled");
    expect(window.document.activeElement?.tagName).not.toBe("TEXTAREA");
  },
);

test("ordinary story clicks leave the reply field unfocused", async () => {
  const { stories } = storyTray(1);
  stories[0].addEventListener("click", () => {
    window.document.querySelector("main")!.innerHTML =
      '<textarea placeholder="Reply to account1..."></textarea>';
  });
  expect(await run("STORY", 1)).toEqual({ ok: true });
  expect(window.document.activeElement?.tagName).not.toBe("TEXTAREA");
});

test("an unavailable story number never clicks another story", async () => {
  const { clicked, unrelated } = storyTray(2);
  expect((await run("STORY", "3")).error).toContain("Story #3 is unavailable");
  expect(clicked).not.toHaveBeenCalled();
  expect(unrelated).not.toHaveBeenCalled();
});

test("stories wait for the Home tray to load", async () => {
  window.history.pushState(null, "", "/");
  window.document.querySelector("main")!.innerHTML = "";
  setTimeout(() => storyTray(2), 10);
  expect(await run("STORY", 2)).toEqual({ ok: true });
  expect(window.location.pathname).toBe("/stories/account2/123/");
});

test("stories require Home and leave open dialogs untouched", async () => {
  const { clicked } = storyTray();
  window.history.pushState(null, "", "/owner/");
  expect((await run("STORY", 1)).error).toContain("Open Home");
  window.history.pushState(null, "", "/");
  const dialog = editor();
  expect((await run("STORY", 1)).error).toContain("Close the current dialog");
  expect(dialog.isConnected).toBe(true);
  expect(clicked).not.toHaveBeenCalled();
});

test("an empty story tray and a click that does not open a story report errors", async () => {
  let now = 0;
  vi.spyOn(window.Date, "now").mockImplementation(() => (now += 1000));
  storyTray(0);
  expect((await run("STORY", 1)).error).toContain("story tray is unavailable");
  storyTray(1);
  const story = window.document.querySelector('[aria-label^="Story by "]')!;
  story.replaceWith(story.cloneNode(true));
  expect((await run("STORY", 1)).error).toContain("did not open story #1");
});

test.each([undefined, "", "0", 0, -1, 1.5, "2x", "1e1", "1.0", Number.MAX_SAFE_INTEGER + 1])(
  "invalid story number %s fails before contacting the browser",
  (index) => {
    for (const action of ["STORY", "STORY_REPLY"] as const) {
      expect(() => buildInstagramJavaScript(action, index)).toThrow("positive safe integer");
    }
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

const gotoActions = ["HOME", "REELS", "MESSAGES", "SEARCH", "CREATE", "PROFILE"] as const;

function bottomNavigation(svgTitles = false) {
  window.document.querySelector("nav")!.hidden = true;
  const icon = (label: string) =>
    svgTitles ? `<svg><title>${label}</title></svg>` : `<svg aria-label="${label}"></svg>`;
  const bar = window.document.createElement("div");
  bar.innerHTML = `
    <a href="/">${icon("Home")}</a>
    <a href="/explore/">${icon("Explore")}</a>
    <div role="button">${icon("New post")}</div>
    <a href="/reels/">${icon("Reels")}</a>
    <a href="/direct/inbox/">${icon("Messenger")}</a>
    <a href="/owner/"><img alt="owner's profile picture" /></a>`;
  const actions = ["HOME", "SEARCH", "CREATE", "REELS", "MESSAGES", "PROFILE"] as const;
  const labels = ["Home", "Explore", "New post", "Reels", "Messenger", "Profile"];
  const clicked = vi.fn();
  for (const [index, target] of [...bar.children].entries()) {
    target.addEventListener("click", (event) => {
      event.preventDefault();
      clicked(actions[index]);
      if (target.tagName === "A") window.history.pushState(null, "", target.getAttribute("href")!);
      if (actions[index] === "SEARCH") {
        window.document
          .querySelector("main")!
          .insertAdjacentHTML(
            "beforeend",
            '<input aria-label="Search input" value="existing query" />',
          );
      } else if (actions[index] === "CREATE") {
        const composer = window.document.createElement("div");
        composer.setAttribute("role", "dialog");
        composer.textContent = "Create new post";
        window.document.body.append(composer);
      }
    });
  }
  // Content avatars and similarly labeled controls must not win by DOM order.
  const content = window.document.createElement("div");
  content.innerHTML = `
    ${labels.map((label) => `<button>${icon(label)}</button>`).join("")}
    <a href="/someone-else/"><img alt="someone-else's profile picture" /></a>`;
  const unrelated = vi.fn();
  content.addEventListener("click", unrelated);
  window.document.querySelector("main")!.prepend(content);
  const suggestion = window.document.createElement("aside");
  suggestion.innerHTML = '<a href="/suggested/"><img alt="suggested\'s profile picture" /></a>';
  suggestion.addEventListener("click", unrelated);
  window.document.body.append(suggestion, bar);
  return { bar, clicked, unrelated };
}

function prepareGoto(action: (typeof gotoActions)[number]) {
  if (action === "SEARCH") {
    window.document.querySelector('a[href="/explore/"]')!.addEventListener("click", () => {
      const input = window.document.createElement("input");
      input.setAttribute("aria-label", "Search input");
      input.value = "existing query";
      window.document.querySelector("main")!.append(input);
    });
  } else if (action === "CREATE") {
    window.document.querySelector('a[href="#"]')!.addEventListener("click", () => {
      const composer = window.document.createElement("div");
      composer.setAttribute("role", "dialog");
      composer.textContent = "Create new post";
      window.document.body.append(composer);
    });
  }
}

function expectGoto(action: (typeof gotoActions)[number]) {
  const paths = {
    HOME: "/",
    REELS: "/reels/",
    MESSAGES: "/direct/inbox/",
    SEARCH: "/explore/",
    CREATE: "/",
    PROFILE: "/owner/",
  };
  expect(window.location.pathname).toBe(paths[action]);
  if (action === "SEARCH") {
    const input = window.document.querySelector<HTMLInputElement>("input")!;
    expect(window.document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
  } else if (action === "CREATE") {
    expect(window.document.querySelector('[role="dialog"]')?.textContent).toBe("Create new post");
  }
}

test.each(gotoActions)("%s uses the icon-only bottom bar", async (action) => {
  window.history.pushState(null, "", "/");
  const { clicked, unrelated } = bottomNavigation();
  expect(await run(action)).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledExactlyOnceWith(action);
  expect(unrelated).not.toHaveBeenCalled();
  expectGoto(action);
});

test.each(gotoActions)("%s also recognizes SVG title icons", async (action) => {
  window.history.pushState(null, "", "/");
  const { clicked, unrelated } = bottomNavigation(true);
  expect(await run(action)).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledExactlyOnceWith(action);
  expect(unrelated).not.toHaveBeenCalled();
  expectGoto(action);
});

test("Profile uses the avatar in the sidebar when its text is absent", async () => {
  const profile = window.document.querySelector('nav a[href="/owner/"]')!;
  profile.innerHTML = '<img alt="owner\'s profile picture" />';
  const clicked = vi.fn();
  profile.addEventListener("click", clicked);
  expect(await run("PROFILE")).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledOnce();
});

test("navigation ignores hidden icons inside otherwise visible controls", async () => {
  const { clicked } = bottomNavigation();
  const hidden = window.document.createElement("nav");
  hidden.innerHTML = '<button><svg aria-label="Home" hidden></svg></button>';
  const hiddenClick = vi.fn();
  hidden.addEventListener("click", hiddenClick);
  window.document.body.prepend(hidden);
  expect(await run("HOME")).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledExactlyOnceWith("HOME");
  expect(hiddenClick).not.toHaveBeenCalled();
});

test("Search prefers its sidebar toggle to a separate Explore icon", async () => {
  prepareGoto("SEARCH");
  const explore = window.document.createElement("a");
  explore.href = "/explore/";
  explore.innerHTML = '<svg aria-label="Explore"></svg>';
  const exploreClick = vi.fn();
  explore.addEventListener("click", exploreClick);
  window.document.querySelector("nav")!.prepend(explore);
  expect(await run("SEARCH")).toEqual({ ok: true });
  expect(exploreClick).not.toHaveBeenCalled();
  expectGoto("SEARCH");
});

test("Search recognizes the compact Search & Explore icon", async () => {
  const { bar, clicked } = bottomNavigation();
  bar.querySelector('svg[aria-label="Explore"]')!.setAttribute("aria-label", "Search & Explore");
  expect(await run("SEARCH")).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledExactlyOnceWith("SEARCH");
  expectGoto("SEARCH");
});

test("bottom bar navigation still works after closing a story", async () => {
  bottomNavigation();
  const { close, send } = storyViewer();
  expect(await run("PROFILE")).toEqual({ ok: true });
  expect(close).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
  expectGoto("PROFILE");
});

function storyViewer(dialog = false) {
  const nav = window.document.querySelector("nav")!;
  nav.setAttribute("aria-hidden", "true");
  window.history.pushState(null, "", "/stories/account1/123/");
  const viewer = window.document.createElement("div");
  if (dialog) viewer.setAttribute("role", "dialog");
  viewer.innerHTML = `<div role="button"><svg aria-label="Close"></svg></div>
    <textarea placeholder="Reply to account1..."></textarea><button>Send</button>`;
  const close = vi.fn(() => {
    setTimeout(() => {
      viewer.remove();
      window.history.pushState(null, "", "/");
      // Navigation can render after the story route has gone away.
      setTimeout(() => nav.removeAttribute("aria-hidden"), 10);
    }, 10);
  });
  viewer.querySelector('[role="button"]')!.addEventListener("click", close);
  const send = vi.fn();
  viewer.querySelector("button")!.addEventListener("click", send);
  window.document.body.append(viewer);
  viewer.querySelector("textarea")!.focus();
  return { viewer, close, send };
}

test.each(gotoActions)("%s leaves a focused story and waits for navigation", async (action) => {
  prepareGoto(action);
  const { viewer, close, send } = storyViewer();
  expect(window.document.activeElement).toBe(viewer.querySelector("textarea"));
  expect(await run(action)).toEqual({ ok: true });
  expect(close).toHaveBeenCalledOnce();
  expect(viewer.isConnected).toBe(false);
  expect(send).not.toHaveBeenCalled();
  expectGoto(action);
});

test.each(gotoActions)("%s also leaves a story marked as a dialog", async (action) => {
  prepareGoto(action);
  const { close, send } = storyViewer(true);
  expect(await run(action)).toEqual({ ok: true });
  expect(close).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
  expectGoto(action);
});

test("goto waits when the story dialog disappears before its route changes", async () => {
  const { viewer, close } = storyViewer(true);
  close.mockImplementation(() => {
    viewer.remove();
    setTimeout(() => {
      window.history.pushState(null, "", "/");
      window.document.querySelector("nav")!.removeAttribute("aria-hidden");
    }, 10);
  });
  expect(await run("HOME")).toEqual({ ok: true });
  expect(close).toHaveBeenCalledOnce();
  expect(window.location.pathname).toBe("/");
});

test.each(gotoActions)("%s closes the current editor before navigating", async (action) => {
  window.history.pushState(null, "", "/");
  prepareGoto(action);
  const dialog = editor();
  const share = vi.fn();
  const remove = vi.fn();
  dialog.querySelectorAll("button")[0].addEventListener("click", share);
  dialog.querySelectorAll("button")[1].addEventListener("click", remove);
  expect(await run(action)).toEqual({ ok: true });
  expect(dialog.isConnected).toBe(false);
  expect(share).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expectGoto(action);
});

test("goto closes stacked dialogs from the top before leaving a story", async () => {
  const { close: closeStory } = storyViewer();
  const first = editor();
  const second = editor();
  const order: string[] = [];
  first.querySelector('[role="button"]')!.addEventListener("click", () => order.push("first"));
  second.querySelector('[role="button"]')!.addEventListener("click", () => order.push("second"));
  expect(await run("HOME")).toEqual({ ok: true });
  expect(order).toEqual(["second", "first"]);
  expect(closeStory).toHaveBeenCalledOnce();
  expect(window.location.pathname).toBe("/");
});

test("goto leaves Instagram's unsaved-draft confirmation for the user", async () => {
  const dialog = editor();
  const discard = vi.fn();
  const navigate = vi.fn();
  window.document.querySelector('a[href="/"]')!.addEventListener("click", navigate);
  dialog.querySelector('[role="button"]')!.addEventListener("click", () => {
    const confirmation = window.document.createElement("div");
    confirmation.setAttribute("role", "dialog");
    confirmation.innerHTML =
      "<h1>Discard note?</h1><button>Discard</button><button>Keep editing</button>";
    confirmation.querySelector("button")!.addEventListener("click", discard);
    window.document.body.append(confirmation);
  });
  expect((await run("HOME")).error).toContain("resolve its confirmation");
  expect(window.document.querySelector('[role="dialog"]')?.textContent).toContain("Discard note?");
  expect(discard).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});

test("goto cannot use a background Close control to dismiss an unrelated dialog", async () => {
  const background = editor();
  const closeBackground = vi.fn();
  background.querySelector('[role="button"]')!.addEventListener("click", closeBackground);
  const foreground = window.document.createElement("div");
  foreground.setAttribute("role", "dialog");
  foreground.innerHTML = "<button>Discard</button><button>Keep editing</button>";
  window.document.body.append(foreground);
  expect((await run("HOME")).error).toContain("resolve its confirmation");
  expect(closeBackground).not.toHaveBeenCalled();
  expect(foreground.isConnected).toBe(true);
});

test("goto reports a stalled story close instead of navigating behind it", async () => {
  let now = 0;
  vi.spyOn(window.Date, "now").mockImplementation(() => (now += 1000));
  const { viewer, close } = storyViewer();
  close.mockImplementation(() => undefined);
  const navigate = vi.fn();
  window.document.querySelector('a[href="/"]')!.addEventListener("click", navigate);
  expect((await run("HOME")).error).toContain("story viewer did not close");
  expect(close).toHaveBeenCalledOnce();
  expect(viewer.isConnected).toBe(true);
  expect(navigate).not.toHaveBeenCalled();
});

test("goto reports an unavailable story Close control", async () => {
  let now = 0;
  vi.spyOn(window.Date, "now").mockImplementation(() => (now += 1000));
  const { viewer } = storyViewer();
  viewer.querySelector('[role="button"]')!.remove();
  expect((await run("HOME")).error).toContain("story viewer Close control is unavailable");
  expect(viewer.isConnected).toBe(true);
  expect(window.location.pathname).toBe("/stories/account1/123/");
});

test.each([
  ["HOME", "/"],
  ["REELS", "/reels/"],
  ["MESSAGES", "/direct/inbox/"],
  ["PROFILE", "/owner/"],
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
  expect(await run("SEARCH")).toEqual({ ok: true });
  const input = window.document.querySelector<HTMLInputElement>("input")!;
  expect(window.document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
  const clicked = vi.fn();
  link.addEventListener("click", clicked);
  expect(await run("SEARCH")).toEqual({ ok: true });
  expect(clicked).not.toHaveBeenCalled();
});

test("Search does not mistake the Messages search field for the navigation search", async () => {
  window.history.pushState(null, "", "/direct/inbox/");
  window.document.querySelector("main")!.innerHTML = '<input placeholder="Search" />';
  const link = window.document.querySelector('a[href="/explore/"]')!;
  const clicked = vi.fn();
  link.addEventListener("click", clicked);
  await run("SEARCH");
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
  expect(await run("CREATE")).toEqual({ ok: true });
  expect(window.document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Create new post",
  );
});

test("Avatar clicks the current profile avatar, never the navigation avatar", async () => {
  const clicked = vi.fn();
  window.document
    .querySelector('button[title="Change profile photo"]')!
    .addEventListener("click", clicked);
  expect(await run("AVATAR")).toEqual({ ok: true });
  expect(clicked).toHaveBeenCalledOnce();
});

test("Notes opens the editor and repeated calls leave it open", async () => {
  const open = vi.fn(editor);
  window.document.querySelector('header [role="button"]')!.addEventListener("click", open);
  expect(await run("NOTE")).toEqual({ ok: true });
  expect(await run("NOTE")).toEqual({ ok: true });
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
  expect(await run("NOTE")).toEqual({ ok: true });
  expect(remove).not.toHaveBeenCalled();
  expect(window.document.querySelector('[contenteditable="true"]')).not.toBeNull();
});

test("Close note only closes its editor and never shares or deletes", async () => {
  const dialog = editor();
  const share = vi.fn();
  const remove = vi.fn();
  dialog.querySelectorAll("button")[0].addEventListener("click", share);
  dialog.querySelectorAll("button")[1].addEventListener("click", remove);
  expect(await run("CLOSE_NOTE")).toEqual({ ok: true });
  expect(dialog.isConnected).toBe(false);
  expect(await run("CLOSE_NOTE")).toEqual({ ok: true });
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
  expect((await run("CLOSE_NOTE")).error).toContain("not an Instagram note editor");
  expect(close).not.toHaveBeenCalled();
});

test("unavailable Notes and avatar controls report a useful error", async () => {
  window.document.querySelector("header")!.remove();
  expect((await run("NOTE")).error).toContain("Open your own profile");
  expect((await run("AVATAR")).error).toContain("Open a profile");
});

test.each(["https://example.com", "https://instagram.com.example.com"])(
  "rejects non-Instagram page %s",
  async (url) => {
    window.happyDOM.setURL(url);
    expect((await run("HOME")).error).toContain("not Instagram");
  },
);

test("unknown actions fail before contacting the browser", () => {
  expect(() => buildInstagramJavaScript("DELETE_NOTE" as InstagramAction)).toThrow(
    "Unknown Instagram action",
  );
});
