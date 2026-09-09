//#region src/js/menu.ts
let addon;
function openMenuAddon() {
  const module = { exports: {} };
  process.dlopen(module, import.meta.chord.resolveNative("menu"));
  return module.exports;
}
async function runMenuAction(processName, action, value) {
  addon ??= openMenuAddon();
  if (action === "by-path") {
    if (
      !Array.isArray(value) ||
      value.length < 2 ||
      value.some((component) => typeof component !== "string" || component.trim().length === 0)
    )
      throw new TypeError('"by-path" expects at least two non-empty string components');
    return addon.runMenuAction(processName, action, JSON.stringify(value));
  }
  return addon.runMenuAction(processName, action, String(value));
}
/**
 * Builds the `emit:menu` handler. `processName` optionally names an app to activate first.
 * Otherwise Chord's captured focused-app bundle identifier is used, avoiding a race with Chord's
 * panel temporarily becoming frontmost. Direct callers without an invocation context retain the
 * frontmost-app fallback.
 */
function buildMenuHandler(processName) {
  return function menu(action, value = 0) {
    return runMenuAction(processName ?? this?.focusedAppId, action, value);
  };
}
//#endregion
export { buildMenuHandler as default, runMenuAction };
