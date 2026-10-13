import { onAppLaunch, onAppTerminate, setAppNeedsRelaunch } from "chord";
//#region src/js/page.ts
async function runInPage(action, storyNumber) {
  try {
    if (location.hostname !== "instagram.com" && !location.hostname.endsWith(".instagram.com"))
      throw new Error("The selected page is not Instagram.");
    const clickable = "a[href], button, [role=button]";
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        !element.closest('[hidden], [inert], [aria-hidden="true"]')
      );
    };
    const enabled = (element) =>
      visible(element) && !element.matches('[disabled], [aria-disabled="true"]');
    const text = (element) => element.textContent?.trim() ?? "";
    const byLabel = (root, labels) => {
      for (const element of root.querySelectorAll("[aria-label], [title], img[alt]")) {
        if (
          !labels.some((label) =>
            ["aria-label", "title", "alt"].some(
              (attribute) => element.getAttribute(attribute) === label,
            ),
          )
        )
          continue;
        const target = element.closest(clickable);
        if (target && root.contains(target) && enabled(target)) return target;
      }
      return [...root.querySelectorAll(clickable)].find(
        (element) => enabled(element) && labels.includes(text(element)),
      );
    };
    const waitFor = async (find, message) => {
      const deadline = Date.now() + 4e3;
      do {
        const result = find();
        if (result) return result;
        await new Promise((resolve) => setTimeout(resolve, 80));
      } while (Date.now() < deadline);
      throw new Error(message);
    };
    const dialogs = () => [...document.querySelectorAll('[role="dialog"]')].filter(visible);
    const noteEditor = () =>
      dialogs().find(
        (dialog) =>
          !!dialog.querySelector(
            '[contenteditable="true"][aria-label="Share a thought..."], textarea[placeholder="Share a thought..."]',
          ) || /\b(New note|Your note)\b/i.test(text(dialog)),
      );
    const searchInput = () =>
      [
        ...document.querySelectorAll(
          'input[aria-label="Search input"], input[placeholder="Search"]',
        ),
      ].find(enabled);
    const click = (element) => {
      element.click();
    };
    if (action === "STORY" || action === "STORY_REPLY") {
      if (dialogs().length) throw new Error("Close the current dialog before opening a story.");
      if (location.pathname !== "/") throw new Error("Open Home before using the story chord.");
      const stories = await waitFor(() => {
        const tray = document.querySelector('main [data-pagelet="story_tray"]');
        if (!tray || !visible(tray)) return void 0;
        const buttons = [
          ...tray.querySelectorAll('[role="button"][aria-label^="Story by "]'),
        ].filter(enabled);
        return buttons.length ? buttons : void 0;
      }, "Instagram's Home story tray is unavailable.");
      const story = stories[storyNumber - 1];
      if (!story)
        throw new Error(
          `Story #${storyNumber} is unavailable; the tray has ${stories.length} stories.`,
        );
      click(story);
      await waitFor(
        () => location.pathname.startsWith("/stories/") || void 0,
        `Instagram did not open story #${storyNumber}.`,
      );
      if (action === "STORY_REPLY") {
        const replyInput = () =>
          [...document.querySelectorAll('textarea, input, [contenteditable="true"]')].find(
            (element) =>
              enabled(element) &&
              !element.matches("[readonly]") &&
              ["placeholder", "aria-label"].some((attribute) =>
                /^(Reply to .+|Send message(?:\.\.\.)?)$/.test(
                  element.getAttribute(attribute) ?? "",
                ),
              ),
          );
        click(
          await waitFor(
            replyInput,
            "This story's reply field is unavailable. Replies may be disabled for this story.",
          ),
        );
        await waitFor(() => {
          const editor = replyInput();
          editor?.focus();
          return editor && document.activeElement === editor ? editor : void 0;
        }, "Instagram did not focus the story reply field.");
      }
    } else if (action === "CLOSE_NOTE") {
      const editor = noteEditor();
      if (!editor) {
        if (dialogs().length) throw new Error("The open dialog is not an Instagram note editor.");
        return JSON.stringify({ ok: true });
      }
      const close = byLabel(editor, ["Close", "Cancel"]);
      if (!close) throw new Error("The note editor's Close control is unavailable.");
      click(close);
      await waitFor(
        () => !visible(editor) || !editor.isConnected || void 0,
        "The note editor did not close.",
      );
    } else if (action === "NOTE") {
      if (noteEditor()) return JSON.stringify({ ok: true });
      if (dialogs().length) throw new Error("Close the current dialog before opening a note.");
      const avatar = document
        .querySelector("main header")
        ?.querySelector('img[alt="Change profile photo"]');
      const section = avatar?.closest("section");
      const note =
        section &&
        (byLabel(section, ["Note...", "Your note", "Leave a note", "Share a note"]) ??
          [...section.querySelectorAll(clickable)].find(
            (element) => enabled(element) && !element.contains(avatar) && !!text(element),
          ));
      if (!note)
        throw new Error(
          "Open your own profile to use Notes. Notes must be available on your account.",
        );
      click(note);
      const editor = await waitFor(
        () => noteEditor() ?? dialogs().find((dialog) => byLabel(dialog, ["Leave a new note"])),
        "Instagram did not open the note editor.",
      );
      if (!noteEditor()) {
        click(byLabel(editor, ["Leave a new note"]));
        await waitFor(noteEditor, "Instagram did not open the new note editor.");
      }
    } else if (action === "AVATAR") {
      if (dialogs().length)
        throw new Error("Close the current dialog before opening the profile avatar.");
      const header = document.querySelector("main header");
      const avatar =
        header &&
        (byLabel(header, ["Change profile photo"]) ??
          [...header.querySelectorAll('img[alt$="profile picture"]')]
            .map((image) => image.closest(clickable))
            .find((element) => element && enabled(element)));
      if (!avatar) throw new Error("Open a profile before using the avatar chord.");
      click(avatar);
    } else {
      for (let closed = 0; dialogs().length; closed++) {
        const dialog = dialogs().at(-1);
        const close = byLabel(dialog, ["Close", "Cancel"]);
        if (!close || closed >= 4)
          throw new Error(
            "Close the current dialog or resolve its confirmation before navigating Instagram.",
          );
        click(close);
        await waitFor(
          () => !dialog.isConnected || !visible(dialog) || void 0,
          "Instagram's current dialog did not close.",
        );
      }
      if (location.pathname.startsWith("/stories/")) {
        const close = await waitFor(
          () => !location.pathname.startsWith("/stories/") || byLabel(document, ["Close"]),
          "Instagram's story viewer Close control is unavailable.",
        );
        if (close !== true) click(close);
        await waitFor(
          () => !location.pathname.startsWith("/stories/") || void 0,
          "Instagram's story viewer did not close.",
        );
        if (dialogs().length)
          throw new Error("Resolve the current confirmation before navigating Instagram.");
      }
      const labels = {
        HOME: ["Home"],
        REELS: ["Reels"],
        MESSAGES: ["Messages", "Messenger"],
        SEARCH: ["Search", "Explore", "Search & Explore"],
        CREATE: ["New post", "Create"],
        PROFILE: ["Profile"],
      };
      const navigationTarget = (icon) => {
        const target = icon.closest(clickable);
        if (
          target &&
          visible(icon) &&
          enabled(target) &&
          !icon.closest('article, [role="dialog"], [data-pagelet="story_tray"]') &&
          (!icon.closest("main") || icon.closest('nav, [role="navigation"]'))
        )
          return target;
      };
      const byIcon = (root, names) => {
        const icons = [...root.querySelectorAll("svg")];
        for (const name of names)
          for (const icon of icons) {
            if (
              (icon.getAttribute("aria-label") ?? text(icon.querySelector("title") ?? icon)) !==
              name
            )
              continue;
            const target = navigationTarget(icon);
            if (target && root.contains(target)) return target;
          }
      };
      const profileIcon = () => {
        for (const image of document.querySelectorAll('a[href] img[alt$="profile picture"]')) {
          const target = navigationTarget(image);
          if (!target) continue;
          for (
            let bar = target.parentElement;
            bar && bar !== document.body;
            bar = bar.parentElement
          ) {
            if (bar.tagName === "MAIN" || bar.querySelector("main")) break;
            if (byIcon(bar, ["Home", "Reels"])) return target;
          }
        }
      };
      const navigation = await waitFor(
        () =>
          byIcon(document, labels[action]) ??
          (action === "PROFILE" ? profileIcon() : void 0) ??
          [...document.querySelectorAll('nav, [role="navigation"]')]
            .flatMap((bar) => [...bar.querySelectorAll(clickable)])
            .find((target) => enabled(target) && labels[action].includes(text(target))),
        `Instagram's ${action.toLowerCase()} navigation control is unavailable.`,
      );
      const destination =
        navigation instanceof HTMLAnchorElement ? new URL(navigation.href).pathname : void 0;
      if (
        !(
          action === "SEARCH" &&
          searchInput() &&
          (location.pathname.startsWith("/explore/") ||
            searchInput()?.getAttribute("aria-label") === "Search input")
        )
      )
        click(navigation);
      if (action === "SEARCH") {
        const input = await waitFor(searchInput, "Instagram's Search input is unavailable.");
        input.click();
        input.focus();
        input.select();
      } else if (action === "CREATE") {
        const post = await waitFor(
          () =>
            dialogs().find((dialog) => /Create new post/i.test(text(dialog))) ??
            byLabel(document, ["Post"]),
          "Instagram's Create post control is unavailable.",
        );
        if (post.getAttribute("role") !== "dialog") click(post);
        await waitFor(
          () => dialogs().find((dialog) => /Create new post/i.test(text(dialog))),
          "Instagram did not open the post composer.",
        );
      } else if (destination && destination !== "#") {
        await waitFor(
          () => location.pathname === destination || void 0,
          `Instagram did not open ${action.toLowerCase()}.`,
        );
        if (action === "PROFILE")
          await waitFor(
            () => document.querySelector('main header img[alt="Change profile photo"]') ?? void 0,
            "Instagram did not finish loading your profile.",
          );
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
function buildInstagramJavaScript(action, storyNumber) {
  if (
    ![
      "HOME",
      "REELS",
      "MESSAGES",
      "SEARCH",
      "CREATE",
      "PROFILE",
      "STORY",
      "STORY_REPLY",
      "AVATAR",
      "NOTE",
      "CLOSE_NOTE",
    ].includes(action)
  )
    throw new Error(`Unknown Instagram action: ${action}`);
  if (action === "STORY" || action === "STORY_REPLY") {
    if (
      (typeof storyNumber !== "number" &&
        (typeof storyNumber !== "string" || !/^\d+$/.test(storyNumber))) ||
      !Number.isSafeInteger(Number(storyNumber)) ||
      Number(storyNumber) < 1
    )
      throw new Error("Story number must be a positive safe integer (1-based).");
    return `(${runInPage.toString()})(${JSON.stringify(action)},${Number(storyNumber)})`;
  }
  return `(${runInPage.toString()})(${JSON.stringify(action)})`;
}
//#endregion
//#region src/js/instagram/cdp.ts
function isInstagramTarget(target) {
  if (target.type !== "page" || !target.webSocketDebuggerUrl) return false;
  try {
    const { hostname } = new URL(target.url);
    return hostname === "instagram.com" || hostname.endsWith(".instagram.com");
  } catch {
    return false;
  }
}
function evaluate(target, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(/* @__PURE__ */ new Error("The Instagram app did not respond to the command.")),
      1e4,
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
      finish(/* @__PURE__ */ new Error("Could not connect to the Instagram app."));
    socket.onclose = () =>
      finish(/* @__PURE__ */ new Error("The Instagram app closed before the command completed."));
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
async function runInstagramJavaScript(source, port) {
  let targets;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2e3),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    targets = (await response.json()).filter(isInstagramTarget);
  } catch {
    throw new Error(
      `Brave's debugging endpoint on port ${port} is unavailable. If Brave is relaunching, try the chord again once Instagram is open. Otherwise use Chord's Brave Browser relaunch button or start Brave with --remote-debugging-port=${port}.`,
    );
  }
  if (!targets.length) throw new Error("Open the Instagram app before using Instagram chords.");
  let target = targets.length === 1 ? targets[0] : void 0;
  if (!target) {
    for (const candidate of targets)
      if (await evaluate(candidate, "document.hasFocus()")) {
        target = candidate;
        break;
      }
  }
  if (!target) throw new Error("Focus the Instagram app before using Instagram chords.");
  return evaluate(target, source);
}
//#endregion
//#region src/js/instagram/browser.ts
const braveBundleId = "com.brave.Browser";
async function run(command, allowedExitCodes = [0]) {
  const child = Bun.spawn(command, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 5e3,
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (!allowedExitCodes.includes(exitCode))
    throw new Error(stderr.trim() || `${command[0]} failed (exit ${exitCode}).`);
  return stdout;
}
/** The installed Instagram app is a shim; its browser owns the debugging endpoint. */
function configureBraveDebugging(port) {
  let pendingRestartPid = null;
  let restartDeadline = 0;
  let checks = Promise.resolve();
  const check = (app) => {
    const pending = checks.then(async () => {
      if (pendingRestartPid !== null && Date.now() <= restartDeadline) return;
      pendingRestartPid = null;
      const command = await run(["/bin/ps", "-p", String(app.pid), "-o", "command="], [0, 1]);
      if (!command.trim()) return;
      const debuggingPort = /(?:^|\s)--remote-debugging-port(?:=|\s+)(\d+)(?=\s|$)/.exec(command);
      const needsRelaunch = Number(debuggingPort?.[1]) !== port;
      setAppNeedsRelaunch(braveBundleId, needsRelaunch);
      if (!needsRelaunch) return;
      if (command.includes("--user-data-dir"))
        throw new Error(
          "Start Brave's custom user-data directory with the Instagram debugging port manually.",
        );
      pendingRestartPid = app.pid;
      restartDeadline = Date.now() + 1e4;
      try {
        await run(["/bin/kill", "-TERM", String(app.pid)]);
      } catch (error) {
        pendingRestartPid = null;
        throw error;
      }
    });
    checks = pending.catch(() => void 0);
    return pending;
  };
  onAppTerminate(braveBundleId, async (app) => {
    setAppNeedsRelaunch(braveBundleId, true);
    if (app.pid !== pendingRestartPid) return;
    pendingRestartPid = null;
    if (Date.now() > restartDeadline) return;
    await run([
      "/usr/bin/open",
      "-n",
      "-b",
      braveBundleId,
      "--args",
      `--remote-debugging-port=${port}`,
      "--restore-last-session",
    ]);
  });
  onAppLaunch(braveBundleId, check);
  return (async () => {
    const pids = (await run(["/usr/bin/pgrep", "-x", "Brave Browser"], [0, 1]))
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    if (!pids.length) {
      setAppNeedsRelaunch(braveBundleId, true);
      return;
    }
    if (pids.length !== 1 || !Number.isSafeInteger(pids[0]) || pids[0] <= 0) {
      setAppNeedsRelaunch(braveBundleId, true);
      throw new Error("Close extra Brave Browser instances before enabling Instagram debugging.");
    }
    await check({
      pid: pids[0],
      bundleId: braveBundleId,
    });
  })();
}
//#endregion
//#region src/js/instagram.ts
function buildHandler(port = 9222) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("The Instagram debugging port must be an integer between 1 and 65535.");
  let startup = configureBraveDebugging(port);
  startup.catch((error) => console.error("Could not enable Brave debugging:", error));
  let previous = Promise.resolve();
  return function handler(action, storyNumber) {
    const pending = previous.then(async () => {
      const source = buildInstagramJavaScript(action, storyNumber);
      const initializing = startup;
      startup = Promise.resolve();
      await initializing;
      const value = await runInstagramJavaScript(source, port);
      const result = JSON.parse(String(value));
      if (result.ok !== true) throw new Error(result.error ?? "Instagram action failed.");
      return true;
    });
    previous = pending.catch(() => void 0);
    return pending;
  };
}
//#endregion
export { buildHandler as default };
