//#region src/js/utils/native.ts
let addon;
async function readRaycastFocus() {
  if (!addon) {
    const module = { exports: {} };
    process.dlopen(module, import.meta.chord.resolveNative("raycast"));
    addon = module.exports;
  }
  return JSON.parse(await addon.readFocus());
}
//#endregion
//#region src/js/raycast.ts
const bundleId = "com.raycast.macos";
const pollIntervalMs = 50;
function isRaycastInputFocused(focus) {
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
function buildRaycastHandler(timeoutMs = 5e3) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new TypeError("Raycast's focus timeout must be a positive integer in milliseconds");
  let pending;
  async function openAndWait() {
    const deadline = performance.now() + timeoutMs;
    const child = Bun.spawn(["/usr/bin/open", "-b", bundleId], {
      stdout: "ignore",
      stderr: "pipe",
      timeout: timeoutMs,
    });
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    if (exitCode !== 0)
      throw new Error(`Unable to open Raycast (exit ${exitCode}): ${stderr.trim()}`);
    while (performance.now() < deadline) {
      if (isRaycastInputFocused(await readRaycastFocus())) return;
      const remaining = deadline - performance.now();
      if (remaining > 0) await Bun.sleep(Math.min(pollIntervalMs, remaining));
    }
    throw new Error(`Raycast's search input did not receive focus within ${timeoutMs}ms`);
  }
  return function raycast() {
    pending ??= openAndWait().finally(() => {
      pending = void 0;
    });
    return pending;
  };
}
//#endregion
export { buildRaycastHandler as default, isRaycastInputFocused };
