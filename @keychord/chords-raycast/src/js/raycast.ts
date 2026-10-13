import { readRaycastFocus, type RaycastFocus } from "./utils/native";

const bundleId = "com.raycast.macos";
const pollIntervalMs = 50;

export function isRaycastInputFocused(focus: RaycastFocus): boolean {
  return (
    focus.bundleId === bundleId &&
    focus.focused === true &&
    (focus.role === "AXTextField" || focus.role === "AXSearchField") &&
    /^Search for apps (?:and|or) commands(?:[.\u2026]|$)/i.test(
      focus.placeholder || focus.description || "",
    )
  );
}

/** Open Raycast; complete the input event only after its main search field owns keyboard focus. */
export default function buildRaycastHandler(timeoutMs = 5_000) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("Raycast's focus timeout must be a positive integer in milliseconds");
  }
  let pending: Promise<void> | undefined;

  async function openAndWait(): Promise<void> {
    const deadline = performance.now() + timeoutMs;
    const child = Bun.spawn(["/usr/bin/open", "-b", bundleId], {
      stdout: "ignore",
      stderr: "pipe",
      timeout: timeoutMs,
    });
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    if (exitCode !== 0) {
      throw new Error(`Unable to open Raycast (exit ${exitCode}): ${stderr.trim()}`);
    }

    while (performance.now() < deadline) {
      if (isRaycastInputFocused(await readRaycastFocus())) return;
      const remaining = deadline - performance.now();
      if (remaining > 0) {
        await Bun.sleep(Math.min(pollIntervalMs, remaining));
      }
    }
    throw new Error(`Raycast's search input did not receive focus within ${timeoutMs}ms`);
  }

  return function raycast(): Promise<void> {
    // Concurrent invocations share the same launch so opening twice cannot toggle the panel.
    pending ??= openAndWait().finally(() => {
      pending = undefined;
    });
    return pending;
  };
}
