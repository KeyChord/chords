import { onAppLaunch, onAppTerminate, setAppNeedsRelaunch } from "chord";
//#region src/js/now-playing.ts
function runInPage$2(action, seconds) {
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
    if (action === "BAR_SCRUB") {
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
    } else if (action === "BAR_PLAY" || action === "BAR_HALT") {
      const button = available(find('[data-testid="control-button-playpause"]'), "Play / Halt");
      const state = button.getAttribute("aria-label");
      if (state !== "Play" && state !== "Pause")
        throw new Error("Could not determine Spotify's playback state.");
      if (state === (action === "BAR_PLAY" ? "Play" : "Pause")) button.click();
    } else {
      const [selector, label] = {
        BAR_PREVIOUS: ['[data-testid="control-button-skip-back"]', "Previous"],
        BAR_NEXT: ['[data-testid="control-button-skip-forward"]', "Next"],
        BAR_REPEAT: ['[data-testid="control-button-repeat"]', "Repeat"],
        BAR_LYRICS: ['[data-testid="lyrics-button"]', "Lyrics"],
        BAR_QUEUE: ['[data-testid="control-button-queue"]', "Queue"],
        BAR_CONNECT: ['button[aria-label="Connect to a device"]', "Connect"],
        BAR_MINIPLAYER: ['[data-testid="pip-toggle-button"]', "Miniplayer"],
        BAR_FULLSCREEN: ['[data-testid="fullscreen-mode-button"]', "Fullscreen"],
        BAR_SHUFFLE: [
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
      "BAR_PREVIOUS",
      "BAR_NEXT",
      "BAR_PLAY",
      "BAR_HALT",
      "BAR_REPEAT",
      "BAR_LYRICS",
      "BAR_QUEUE",
      "BAR_CONNECT",
      "BAR_MINIPLAYER",
      "BAR_FULLSCREEN",
      "BAR_SHUFFLE",
      "BAR_SCRUB",
    ].includes(action)
  )
    throw new Error(`Unknown Spotify action: ${action}`);
  let target;
  if (action === "BAR_SCRUB") {
    if (typeof seconds === "string" && !/^\d+$/.test(seconds))
      throw new Error("Scrub time must be a non-negative safe integer.");
    target = Number(seconds);
    if (!Number.isSafeInteger(target) || target < 0)
      throw new Error("Scrub time must be a non-negative safe integer.");
  }
  return `(${runInPage$2.toString()})(${JSON.stringify(action)}, ${JSON.stringify(target) ?? "undefined"})`;
}
//#endregion
//#region src/js/navigation.ts
async function gotoLikedSongs() {
  try {
    if (location.hostname !== "xpui.app.spotify.com")
      throw new Error("The selected page is not the Spotify desktop app.");
    function* values(container) {
      const stack = [container.stateNode?.current ?? container];
      while (stack.length) {
        const fiber = stack.pop();
        if (fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
        if (fiber.memoizedProps?.value) yield fiber.memoizedProps.value;
      }
    }
    let container;
    let navigator;
    for (const element of document.querySelectorAll("*")) {
      const key = Object.keys(element).find((name) => name.startsWith("__reactContainer$"));
      if (!key) continue;
      const root = element[key];
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
    if (!navigator || !container)
      throw new Error("Spotify's navigation API is unavailable. Open the main Spotify window.");
    const previousKey = navigator.location.key;
    navigator.replace("/collection/tracks", {});
    const destination = navigator.location;
    if (
      destination.pathname !== "/collection/tracks" ||
      destination.search ||
      destination.hash ||
      Object.keys(destination.state ?? {}).length ||
      destination.key === previousKey
    )
      throw new Error("Spotify did not navigate to Liked Songs.");
    const deadline = Date.now() + 3e3;
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
    return JSON.stringify({
      ok: false,
      error: error.message,
    });
  }
}
function buildSpotifyNavigationJavaScript() {
  return `(${gotoLikedSongs.toString()})()`;
}
//#endregion
//#region src/js/now-playing-view.ts
async function runInPage$1(action) {
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
    const find = (selector, scope = document) =>
      [...scope.querySelectorAll(selector)].find(visible);
    const panel = () => find('aside[aria-label="Now playing view"]');
    const minimize = () => find('button[aria-label="Minimize Now Playing view"]');
    const isOpen = () => !!(minimize() || panel());
    function click(element, label) {
      if (
        !element ||
        !visible(element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      )
        throw new Error(`The ${label} control is unavailable in Spotify's Now Playing view.`);
      element.click();
    }
    function waitFor(find, message) {
      const found = find();
      if (found !== void 0) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const observer = new MutationObserver(() => {
          const value = find();
          if (value !== void 0) {
            clearTimeout(timer);
            observer.disconnect();
            resolve(value);
          }
        });
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error(message));
        }, 1500);
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
        });
      });
    }
    async function collapse() {
      const button = minimize();
      if (!button) return;
      click(button, "Minimize");
      await waitFor(
        () => (!minimize() && panel()) || void 0,
        "Spotify did not minimize the Now Playing view.",
      );
    }
    if (action === "NP_HIDE" || action === "NP_TOGGLE") {
      if (isOpen()) {
        await collapse();
        click(
          find('button[aria-label="Hide Now Playing view"]', panel()) ??
            find('[data-testid="now-playing-bar"] [data-testid="cover-art-button"]'),
          "Hide",
        );
        await waitFor(
          () => (!isOpen() ? true : void 0),
          "Spotify did not hide the Now Playing view.",
        );
        return JSON.stringify({ ok: true });
      }
      if (action === "NP_HIDE") return JSON.stringify({ ok: true });
    }
    if (action === "NP_MINIMIZE") {
      await collapse();
      return JSON.stringify({ ok: true });
    }
    if (!isOpen()) {
      click(
        find('button[aria-label="Show Now Playing view"]') ??
          find('[data-testid="now-playing-bar"] [data-testid="cover-art-button"]'),
        "Show",
      );
      await waitFor(() => (isOpen() ? true : void 0), "Spotify did not open the Now Playing view.");
    }
    if (action === "NP_TOGGLE") return JSON.stringify({ ok: true });
    if (!minimize()) {
      click(find('button[aria-label="Expand Now Playing view"]', panel()), "Expand");
      await waitFor(minimize, "Spotify did not expand the Now Playing view.");
    }
    if (action === "NP_EXPAND") return JSON.stringify({ ok: true });
    const [value, label] = {
      NP_ARTWORK: ["artwork", "Artwork"],
      NP_CANVAS: ["canvas", "Canvas"],
      NP_ARTIST_IMAGE: ["hero", "Artist image"],
      NP_LYRICS: ["lyrics", "Lyrics"],
    }[action];
    const selector = `[role="radiogroup"][aria-label="Media control options"] button[role="radio"][value="${value}"]`;
    const radio = find(selector);
    if (radio?.getAttribute("aria-checked") !== "true") {
      click(radio, label);
      await waitFor(
        () => (find(selector)?.getAttribute("aria-checked") === "true" ? true : void 0),
        `Spotify did not select ${label} in the Now Playing view.`,
      );
    }
    return JSON.stringify({ ok: true });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error.message,
    });
  }
}
function buildSpotifyNowPlayingJavaScript(action) {
  if (
    ![
      "NP_TOGGLE",
      "NP_HIDE",
      "NP_EXPAND",
      "NP_MINIMIZE",
      "NP_ARTWORK",
      "NP_CANVAS",
      "NP_ARTIST_IMAGE",
      "NP_LYRICS",
    ].includes(action)
  )
    throw new Error(`Unknown Spotify action: ${action}`);
  return `(${runInPage$1.toString()})(${JSON.stringify(action)})`;
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
    if (action === "MORE") return JSON.stringify({ ok: true });
    const wanted = {
      REMOVE: [
        "Remove from this playlist",
        "Remove from playlist",
        ...(list.getAttribute("aria-label") === "Liked Songs"
          ? ["Remove from Liked Songs", "Remove from your Liked Songs"]
          : []),
      ],
      QUEUE: ["Add to queue"],
      EXCLUDE: ["Exclude from your taste profile"],
      JAM: ["Start a Jam"],
      SONG_RADIO: ["Go to song radio"],
      ARTIST: ["Go to artist"],
      ALBUM: ["Go to album"],
      CREDITS: ["View credits"],
      COPY_LINK: ["Copy link to Song", "Copy song link"],
      EMBED: ["Embed track"],
    }[action];
    let scope = menu;
    if (action === "COPY_LINK" || action === "EMBED") {
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
  if (action === "LIKED_SONGS") return buildSpotifyNavigationJavaScript();
  if (action.startsWith("NP_")) return buildSpotifyNowPlayingJavaScript(action);
  if (action.startsWith("BAR_")) return buildSpotifyBarJavaScript(action, index);
  if (
    ![
      "MORE",
      "REMOVE",
      "QUEUE",
      "EXCLUDE",
      "JAM",
      "SONG_RADIO",
      "ARTIST",
      "ALBUM",
      "CREDITS",
      "COPY_LINK",
      "EMBED",
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
//#region src/js/spotify/cdp.ts
function isSpotifyTarget(target) {
  if (target.type !== "page" || !target.webSocketDebuggerUrl) return false;
  try {
    return new URL(target.url).hostname === "xpui.app.spotify.com";
  } catch {
    return false;
  }
}
function evaluate(target, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () => finish(/* @__PURE__ */ new Error("The Spotify app did not respond to the command.")),
      5e3,
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
      finish(/* @__PURE__ */ new Error("Could not connect to the Spotify app."));
    socket.onclose = () =>
      finish(/* @__PURE__ */ new Error("The Spotify app closed before the command completed."));
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
async function runSpotifyJavaScript(source, port) {
  let targets;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(2e3),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    targets = (await response.json()).filter(isSpotifyTarget);
  } catch {
    throw new Error(
      `Spotify's debugging endpoint on port ${port} is unavailable. If Spotify is relaunching, try the chord again once it is open. Otherwise use Chord's Spotify relaunch button or start Spotify with --remote-debugging-port=${port}. See the chords-spotify README for setup.`,
    );
  }
  if (targets.length === 0)
    throw new Error("Open the Spotify desktop app before using Spotify chords.");
  let target;
  if (targets.length === 1) target = targets[0];
  else
    for (const candidate of targets)
      if (await evaluate(candidate, "document.hasFocus()")) {
        target = candidate;
        break;
      }
  if (!target) throw new Error("Focus the Spotify app before using Spotify chords.");
  return evaluate(target, source);
}
//#endregion
//#region src/js/spotify/app.ts
const spotifyBundleId = "com.spotify.client";
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
function configureSpotifyDebugging(port) {
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
      setAppNeedsRelaunch(spotifyBundleId, needsRelaunch);
      if (!needsRelaunch) return;
      if (command.includes("--user-data-dir"))
        throw new Error(
          "Start Spotify's custom user-data directory with the debugging port manually.",
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
  onAppTerminate(spotifyBundleId, async (app) => {
    setAppNeedsRelaunch(spotifyBundleId, true);
    if (app.pid !== pendingRestartPid) return;
    pendingRestartPid = null;
    if (Date.now() > restartDeadline) return;
    await run([
      "/usr/bin/open",
      "-n",
      "-b",
      spotifyBundleId,
      "--args",
      `--remote-debugging-port=${port}`,
    ]);
  });
  onAppLaunch(spotifyBundleId, check);
  return (async () => {
    const pids = (await run(["/usr/bin/pgrep", "-x", "Spotify"], [0, 1]))
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    if (!pids.length) {
      setAppNeedsRelaunch(spotifyBundleId, true);
      return;
    }
    if (pids.length !== 1 || !Number.isSafeInteger(pids[0]) || pids[0] <= 0) {
      setAppNeedsRelaunch(spotifyBundleId, true);
      throw new Error("Close extra Spotify instances before enabling debugging.");
    }
    await check({
      pid: pids[0],
      bundleId: spotifyBundleId,
    });
  })();
}
//#endregion
//#region src/js/spotify.ts
function buildHandler(port = 9223) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("The Spotify debugging port must be an integer between 1 and 65535.");
  let startup = configureSpotifyDebugging(port);
  startup.catch((error) => console.error("Could not enable Spotify debugging:", error));
  let previous = Promise.resolve();
  return function handler(action, index) {
    const pending = previous.then(async () => {
      const source = buildSpotifyJavaScript(action, index);
      const initializing = startup;
      startup = Promise.resolve();
      await initializing;
      const value = await runSpotifyJavaScript(source, port);
      const result = JSON.parse(String(value));
      if (result.ok !== true) throw new Error(result.error ?? "Spotify action failed.");
      return true;
    });
    previous = pending.catch(() => void 0);
    return pending;
  };
}
//#endregion
export { buildHandler as default };
