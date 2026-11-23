import { expect, test } from "bun:test";
import buildRaycastHandler, { raycastDeeplink } from "../src/js/raycast-windows";

test("preserves Raycast command arguments while validating its URL", () => {
  const url =
    "raycast://extensions/raycast/clipboard-history/clipboard-history?arguments=%7B%22query%22%3A%22caf%C3%A9%22%7D";
  expect(raycastDeeplink("raycast://")).toBe("raycast://");
  expect(raycastDeeplink(url)).toBe(url);
});

test("rejects arbitrary search terms, other protocols and malformed command URLs", () => {
  for (const value of [
    "calculator",
    "https://extensions/raycast/clipboard-history/clipboard-history",
    "raycast://settings",
    "raycast://extensions:9/raycast/clipboard-history/clipboard-history",
    "raycast://extensions/raycast//clipboard-history/clipboard-history",
    "raycast://example@extensions/raycast/clipboard-history/clipboard-history",
    "raycast://extensions/raycast/clipboard-history/clipboard-history#fragment",
  ]) {
    expect(() => raycastDeeplink(value)).toThrow("Expected a Raycast command deeplink");
  }
});

test("loads the Windows launcher without loading a Windows DLL on other operating systems", async () => {
  if (process.platform !== "win32") {
    await expect(buildRaycastHandler()()).rejects.toThrow("requires Windows");
  }
});
