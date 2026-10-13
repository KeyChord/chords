import {
  readRaycastState,
  setRaycastSearch,
  activateRaycastSearch,
  type RaycastState,
} from "./utils/native";

const bundleId = "com.raycast.macos";
const pollIntervalMs = 50;

export function isRaycastInputFocused(state: RaycastState): boolean {
  return (
    state.bundleId === bundleId &&
    state.focused === true &&
    (state.role === "AXTextField" || state.role === "AXSearchField") &&
    /^Search for apps (?:and|or) commands(?:[.\u2026]|$)/i.test(
      state.placeholder || state.description || "",
    )
  );
}

function commandDeeplink(value: string): string {
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

/** Prefer official command deeplinks; use Accessibility only for arbitrary root-search queries. */
export default function buildRaycastHandler(
  timeoutMs = 5_000,
  commands: Record<string, string> = {},
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Raycast's timeout must be a positive integer in milliseconds");
  }
  const directCommands = new Map(
    Object.entries(commands).map(([query, url]) => [query, commandDeeplink(url)]),
  );
  let pending: { query: string; action: Promise<void> } | undefined;

  async function open(args: string[]): Promise<void> {
    const child = Bun.spawn(["/usr/bin/open", ...args], {
      stdout: "ignore",
      stderr: "pipe",
      timeout: timeoutMs,
    });
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    if (exitCode !== 0)
      throw new Error(`Unable to open Raycast (exit ${exitCode}): ${stderr.trim()}`);
  }

  async function pause(deadline: number): Promise<void> {
    const remaining = deadline - performance.now();
    if (remaining > 0) await Bun.sleep(Math.min(pollIntervalMs, remaining));
  }

  async function run(query: string): Promise<void> {
    const direct =
      directCommands.get(query) ?? (/^raycast:/i.test(query) ? commandDeeplink(query) : undefined);
    if (direct) {
      // URL delivery is the supported external interface. Raycast controls command
      // execution and any first-use confirmation; never fall back after delivery.
      await open([direct]);
      return;
    }
    const deadline = performance.now() + timeoutMs;
    await open(["-b", bundleId]);
    let initial: RaycastState | undefined;
    while (performance.now() < deadline) {
      const state = await readRaycastState();
      if (isRaycastInputFocused(state)) {
        initial = state;
        break;
      }
      await pause(deadline);
    }
    if (!initial)
      throw new Error(`Raycast's search input did not receive focus within ${timeoutMs}ms`);
    if (!query) return;

    // One AXValue assignment replaces the entire query, avoiding races between
    // Select All and individual Unicode key events (including a dropped first letter).
    await setRaycastSearch(query);
    let previousFingerprint: string | undefined;
    let activated = false;
    while (performance.now() < deadline) {
      const state = await readRaycastState();
      if (!isRaycastInputFocused(state))
        throw new Error("Raycast's search input lost focus before activation");
      const updated = initial.value === query || state.fingerprint !== initial.fingerprint;
      const ready =
        state.value === query &&
        state.rootSearchVisible &&
        !state.busy &&
        state.fingerprint &&
        updated;
      if (ready && previousFingerprint === state.fingerprint) {
        // Native code re-reads focus, query and the action fingerprint immediately
        // before AXPress. A changed result goes back through readiness, not submission.
        if (await activateRaycastSearch(query, state.fingerprint!)) {
          activated = true;
          break;
        }
        previousFingerprint = undefined;
      } else {
        previousFingerprint = ready ? state.fingerprint : undefined;
      }
      await pause(deadline);
    }
    if (!activated) throw new Error(`Raycast's results did not become ready within ${timeoutMs}ms`);

    // AXPress can time out after dispatching its callback. Observe completion and
    // never press twice: launching a command twice can have non-idempotent effects.
    while (performance.now() < deadline) {
      const state = await readRaycastState();
      if (state.bundleId !== bundleId || state.rootSearchVisible === false) return;
      await pause(deadline);
    }
    throw new Error(
      `Raycast's primary action was invoked but activation was not confirmed within ${timeoutMs}ms`,
    );
  }

  return function raycast(query = ""): Promise<void> {
    if (typeof query !== "string")
      return Promise.reject(new TypeError("Raycast's query must be a string"));
    if (pending?.query === query) return pending.action;
    const previous = pending?.action;
    const action = (
      previous ? previous.catch(() => {}).then(() => run(query)) : run(query)
    ).finally(() => {
      if (pending?.action === action) pending = undefined;
    });
    pending = { query, action };
    return action;
  };
}
