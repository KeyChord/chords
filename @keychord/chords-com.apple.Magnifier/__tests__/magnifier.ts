import { flattenAX, waitFor, type MacOSProbe } from "@keychord/chordtest";

export const bundle = "com.apple.Magnifier";
export const zoom = {
  zi: "Zoom In",
  zo: "Zoom Out",
  za: "Zoom to Fit",
};

export async function activateMagnifier(probe: MacOSProbe) {
  await probe.activate(bundle);
  await waitFor(async () => {
    const windows = await probe.windows(bundle, 7);
    const button = flattenAX(windows).find(
      (node) => node.role === "AXButton" && [node.title, node.description].includes("Continue"),
    );
    if (button?.position && button.size) {
      await probe.clickPoint(
        button.position[0] + button.size[0] / 2,
        button.position[1] + button.size[1] / 2,
      );
      return;
    }
    const newWindow = await probe.menu(bundle, "File", "New").catch(() => undefined);
    return windows.length && newWindow?.enabled ? true : undefined;
  }, 20_000);
}
