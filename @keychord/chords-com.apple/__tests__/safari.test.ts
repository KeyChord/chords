import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import buildSafariHandler from "../src/js/safari";

const { openDeveloperSettings, runJavaScript } = vi.hoisted(() => ({
  openDeveloperSettings: vi.fn(),
  runJavaScript: vi.fn(),
}));
vi.mock("../src/js/safari.node", () => ({
  default: { openDeveloperSettings, runJavaScript },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("Bun", {
    spawn: (command: string[]) => ({
      exited: Promise.resolve(0),
      stdout: new Response(command.includes("IncludeDevelopMenu") ? "1" : "0").body,
      stderr: new Response("").body,
    }),
  });
});

afterEach(() => vi.unstubAllGlobals());

test("Safari waits for its native Developer settings action to finish", async () => {
  let finish!: () => void;
  openDeveloperSettings.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
  const handler = await buildSafariHandler();
  let completed = false;
  const action = handler().then(() => (completed = true));
  await Promise.resolve();
  await Promise.resolve();
  expect(openDeveloperSettings).toHaveBeenCalledOnce();
  expect(completed).toBe(false);
  finish();
  await action;
  expect(completed).toBe(true);
  expect(runJavaScript).not.toHaveBeenCalled();
});

test("Safari propagates native Developer settings failures", async () => {
  openDeveloperSettings.mockRejectedValue(new Error("Developer button is unavailable"));
  const handler = await buildSafariHandler();
  await expect(handler()).rejects.toThrow("Developer button is unavailable");
});
