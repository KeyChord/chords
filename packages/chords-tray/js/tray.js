//#region src/js/tray.ts
let addon;
function openTrayAddon() {
  const module = { exports: {} };
  process.dlopen(module, import.meta.chord.resolveNative("tray"));
  return module.exports;
}
function runTrayAction(trayIndex, clickType = "left") {
  addon ??= openTrayAddon();
  return addon.runTrayAction(trayIndex, clickType);
}
/**
 * Builds the tray handler. Positive indexes count from the first menu-bar extra to the right of
 * the application menus; negative indexes count from the right edge.
 */
function buildHandler() {
  return runTrayAction;
}
//#endregion
export { buildHandler as default, runTrayAction };
