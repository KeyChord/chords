import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import buildSafariHandler from "../src/js/safari";

const openDeveloperSettings = mock();
const runJavaScript = mock();
mock.module("../src/js/safari.node", () => ({
  default: { openDeveloperSettings, runJavaScript },
}));

beforeEach(() => {
  openDeveloperSettings.mockReset();
  runJavaScript.mockReset();
  spyOn(Bun, "spawn").mockImplementation(
    (command) =>
      ({
        exited: Promise.resolve(0),
        stdout: new Response((command as string[]).includes("IncludeDevelopMenu") ? "1" : "0").body,
        stderr: new Response("").body,
      }) as never,
  );
});

afterEach(() => mock.restore());

test("Safari waits for its native Developer settings action to finish", async () => {
  let finish!: () => void;
  openDeveloperSettings.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
  const handler = await buildSafariHandler();
  let completed = false;
  const action = handler().then(() => (completed = true));
  await Promise.resolve();
  await Promise.resolve();
  expect(openDeveloperSettings).toHaveBeenCalledTimes(1);
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
