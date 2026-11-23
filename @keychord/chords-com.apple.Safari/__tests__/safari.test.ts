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
    () =>
      ({
        exited: Promise.resolve(0),
        stdout: new Response("0").body,
        stderr: new Response("").body,
      }) as never,
  );
});

afterEach(() => mock.restore());

test("Safari waits for its native Developer settings action to finish", async () => {
  let finish!: () => void;
  const nativeAction = new Promise<void>((resolve) => (finish = resolve));
  let started!: () => void;
  const start = new Promise<void>((resolve) => (started = resolve));
  openDeveloperSettings.mockImplementation(() => {
    started();
    return nativeAction;
  });
  const handler = buildSafariHandler();
  let completed = false;
  const action = handler().then(() => (completed = true));
  await start;
  expect(openDeveloperSettings).toHaveBeenCalledTimes(1);
  expect(completed).toBe(false);
  finish();
  await action;
  expect(completed).toBe(true);
  expect(runJavaScript).not.toHaveBeenCalled();
});

test("Safari propagates native Developer settings failures", async () => {
  openDeveloperSettings.mockRejectedValue(new Error("Developer button is unavailable"));
  const handler = buildSafariHandler();
  await expect(handler()).rejects.toThrow("Developer button is unavailable");
});
