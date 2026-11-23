import addon from "./application.node";

export default function buildDockHandler() {
  return function dock(index: string, action: "FOCUS" | "LEFT" | "RIGHT" = "FOCUS") {
    const number = Number(index);
    if (!/^\d+$/.test(index) || !Number.isSafeInteger(number) || number < 1)
      return Promise.reject(new RangeError("Dock item numbers start at 1"));
    return addon.runDockItem(number, action);
  };
}
