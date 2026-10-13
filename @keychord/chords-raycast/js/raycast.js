import { n as __toESM } from "./chunk-BYIdrdsR.js";
//#region src/js/utils/native.ts
let addon;
const native = async () =>
  (
    await (addon ??= import("./_keychord-native_raycast-oAipIlqf.js").then((m) =>
      /* @__PURE__ */ __toESM(m.default, 1),
    ))
  ).default;
async function readRaycastState() {
  return JSON.parse(await (await native()).readState());
}
async function setRaycastSearch(query, remainingMs) {
  await (await native()).setSearch(query, remainingMs);
}
async function returnToRaycastRoot(fingerprint, remainingMs) {
  return JSON.parse(await (await native()).returnToRoot(fingerprint, remainingMs));
}
async function activateRaycastSearch(query, fingerprint, remainingMs) {
  return JSON.parse(await (await native()).activateSearch(query, fingerprint, remainingMs));
}
//#endregion
//#region src/js/raycast.ts
const bundleId = "com.raycast.macos";
const pollIntervalMs = 50;
function isRaycastInputFocused(state) {
  return (
    state.bundleId === bundleId &&
    state.focused === true &&
    (state.role === "AXTextField" || state.role === "AXSearchField") &&
    /^Search for apps (?:and|or) commands(?:[.\u2026]|$)/i.test(
      state.placeholder || state.description || "",
    )
  );
}
function commandDeeplink(value) {
  const url = new URL(value);
  if (
    url.protocol !== "raycast:" ||
    url.hostname !== "extensions" ||
    url.pathname.split("/").filter(Boolean).length !== 3 ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new TypeError(
      "Expected a Raycast command deeplink: raycast://extensions/owner/extension/command",
    );
  return url.href;
}
async function pause(deadline) {
  const remaining = deadline - performance.now();
  if (remaining > 0) await Bun.sleep(Math.min(pollIntervalMs, remaining));
}
/** Complete a search in an already-open Raycast window; also used by native integration tests. */
async function searchRaycast(query, timeoutMs = 5e3, deadline = performance.now() + timeoutMs) {
  let initial;
  let previousNavigation;
  while (performance.now() < deadline) {
    const state = await readRaycastState();
    if (performance.now() >= deadline) break;
    if (isRaycastInputFocused(state)) {
      initial = state;
      break;
    }
    if (
      state.bundleId === bundleId &&
      state.focused &&
      state.navigationFingerprint &&
      state.navigationFingerprint !== previousNavigation
    ) {
      if (await returnToRaycastRoot(state.navigationFingerprint, deadline - performance.now()))
        previousNavigation = state.navigationFingerprint;
    }
    await pause(deadline);
  }
  if (!initial)
    throw new Error(`Raycast's search input did not receive focus within ${timeoutMs}ms`);
  if (!query) return;
  if (initial.value === query) {
    await setRaycastSearch("", deadline - performance.now());
    let cleared;
    while (performance.now() < deadline) {
      const state = await readRaycastState();
      if (performance.now() >= deadline) break;
      if (!isRaycastInputFocused(state))
        throw new Error("Raycast's search input lost focus while resetting selection");
      if (
        state.value === "" &&
        !state.busy &&
        (state.fingerprint !== initial.fingerprint || state.rootSearchVisible === false)
      ) {
        cleared = state;
        break;
      }
      await pause(deadline);
    }
    if (!cleared)
      throw new Error(`Raycast's previous selection did not reset within ${timeoutMs}ms`);
    initial = cleared;
  }
  await setRaycastSearch(query, deadline - performance.now());
  let previousFingerprint;
  let activated = false;
  while (performance.now() < deadline) {
    const state = await readRaycastState();
    if (performance.now() >= deadline) break;
    if (!isRaycastInputFocused(state))
      throw new Error("Raycast's search input lost focus before activation");
    const updated = state.fingerprint !== initial.fingerprint;
    const ready =
      state.value === query &&
      state.rootSearchVisible &&
      !state.busy &&
      state.fingerprint &&
      updated;
    if (ready && previousFingerprint === state.fingerprint) {
      if (await activateRaycastSearch(query, state.fingerprint, deadline - performance.now())) {
        activated = true;
        break;
      }
      previousFingerprint = void 0;
    } else previousFingerprint = ready ? state.fingerprint : void 0;
    await pause(deadline);
  }
  if (!activated) throw new Error(`Raycast's results did not become ready within ${timeoutMs}ms`);
  while (performance.now() < deadline) {
    const state = await readRaycastState();
    if (state.bundleId !== bundleId || state.rootSearchVisible === false) return;
    await pause(deadline);
  }
  throw new Error(
    `Raycast's primary action was invoked but activation was not confirmed within ${timeoutMs}ms`,
  );
}
/** Prefer official command deeplinks; use Accessibility only for arbitrary root-search queries. */
function buildRaycastHandler(timeoutMs = 5e3, commands = {}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new TypeError("Raycast's timeout must be a positive integer in milliseconds");
  const directCommands = new Map(
    Object.entries(commands).map(([query, url]) => [query, commandDeeplink(url)]),
  );
  let pending;
  async function open(args) {
    const child = Bun.spawn(["/usr/bin/open", ...args], {
      stdout: "ignore",
      stderr: "pipe",
      timeout: timeoutMs,
    });
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    if (exitCode !== 0)
      throw new Error(`Unable to open Raycast (exit ${exitCode}): ${stderr.trim()}`);
  }
  async function run(query) {
    const direct =
      directCommands.get(query) ?? (/^raycast:/i.test(query) ? commandDeeplink(query) : void 0);
    if (direct) {
      await open([direct]);
      return;
    }
    const deadline = performance.now() + timeoutMs;
    await open(["-b", bundleId]);
    await searchRaycast(query, timeoutMs, deadline);
  }
  return function raycast(query = "") {
    if (typeof query !== "string")
      return Promise.reject(/* @__PURE__ */ new TypeError("Raycast's query must be a string"));
    if (pending?.query === query) return pending.action;
    const previous = pending?.action;
    const action = (
      previous ? previous.catch(() => {}).then(() => run(query)) : run(query)
    ).finally(() => {
      if (pending?.action === action) pending = void 0;
    });
    pending = {
      query,
      action,
    };
    return action;
  };
}
//#endregion
export { buildRaycastHandler as default, isRaycastInputFocused, searchRaycast };
