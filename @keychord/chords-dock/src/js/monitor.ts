import addon from "./monitor.node";

/** Resolution changes require a complete pair of absolute integer dimensions. */
export function parseMonitorResolution(expression: string): { width: number; height: number } {
  const match = typeof expression === "string" && /^([1-9]\d*)x([1-9]\d*)$/.exec(expression.trim());
  if (!match) throw new TypeError("Expected an absolute monitor resolution such as 1920x1080");
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
    throw new TypeError("Monitor resolution exceeds the safe integer range");
  }
  return { width, height };
}

export default function buildMonitorHandler() {
  let pending = Promise.resolve();
  return function monitor(target: string, action: "FOCUS" | "SIZE" = "FOCUS"): Promise<void> {
    let operation: () => Promise<void>;
    try {
      if (action === "SIZE") {
        const { width, height } = parseMonitorResolution(target);
        operation = () => addon.setMonitorResolution(width, height);
      } else if (action === "FOCUS") {
        if (
          typeof target !== "string" ||
          !/^(?:[1-9]\d*|PREVIOUS|NEXT|LEFT|RIGHT|UP|DOWN)$/.test(target) ||
          (/^\d/.test(target) && !Number.isSafeInteger(Number(target)))
        ) {
          throw new TypeError("Expected a positive monitor number or direction");
        }
        operation = () => addon.focusMonitor(target);
      } else {
        throw new TypeError("Unknown monitor action");
      }
    } catch (error) {
      return Promise.reject(error);
    }
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  };
}
