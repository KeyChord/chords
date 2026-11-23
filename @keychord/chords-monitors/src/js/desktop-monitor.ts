import { focusLinux } from "./desktop-monitor/linux";

export default function buildMonitorHandler() {
  let pending = Promise.resolve();
  return function monitor(target: string): Promise<void> {
    if (
      typeof target !== "string" ||
      !/^(?:[1-9]\d*|PREVIOUS|NEXT|LEFT|RIGHT|UP|DOWN)$/.test(target) ||
      (/^\d/.test(target) && !Number.isSafeInteger(Number(target)))
    ) {
      return Promise.reject(new TypeError("Expected a positive monitor number or direction"));
    }

    const result = pending.then(async () => {
      if (process.platform === "linux") {
        await focusLinux(target);
      } else if (process.platform === "win32") {
        const { focusWindows } = await import("./desktop-monitor/windows");
        focusWindows(target);
      } else {
        throw new Error("This monitor handler is available on Linux and Windows");
      }
    });
    pending = result.catch(() => {});
    return result;
  };
}
