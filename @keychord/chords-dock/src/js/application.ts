import addon from "./application.node";

export default function buildApplicationHandler() {
  let pending = Promise.resolve();
  return function application(
    this: { focusedAppId?: string } | void,
    direction: string,
  ): Promise<void> {
    if (direction !== "NEXT" && direction !== "PREVIOUS")
      return Promise.reject(new TypeError("Unknown application cycle direction"));
    const appId = this?.focusedAppId;
    const result = pending.then(() => addon.cycleApplication(appId, direction));
    pending = result.catch(() => {});
    return result;
  };
}
