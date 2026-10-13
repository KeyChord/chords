import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import buildRaycastHandler, { isRaycastInputFocused } from "../src/js/raycast";

const readFocus = vi.hoisted(() => vi.fn());
vi.mock("../src/js/utils/native", () => ({ readRaycastFocus: readFocus }));

const ready = {
  bundleId: "com.raycast.macos",
  role: "AXTextField",
  placeholder: "Search for apps or commands…",
  focused: true,
};
const spawn = vi.fn();

function launchResult(exitCode = 0, stderr = "") {
  return { exited: Promise.resolve(exitCode), stderr: new Response(stderr).body };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  spawn.mockReset().mockImplementation(() => launchResult());
  readFocus.mockReset().mockResolvedValue(ready);
  vi.stubGlobal("Bun", {
    spawn,
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("/r emits the input event and loads the TypeScript handler's generated module", () => {
  const source = readFileSync(
    new URL("../chords/com/raycast/macos/macos.toml", import.meta.url),
    "utf8",
  );
  expect(source).toMatch(/\[on\.raycast\]\s+file = "raycast\.js"/);
  expect(source).toMatch(/^'\/r' = \{ name = "Raycast", '@input:raycast' = \[\] \}$/m);
  expect(source).not.toContain("shell =");
});

test("app activation alone leaves the Promise pending until the search input gets focus", async () => {
  readFocus
    .mockResolvedValueOnce({ bundleId: "com.raycast.macos" })
    .mockResolvedValueOnce({ ...ready, role: "AXButton" })
    .mockResolvedValue(ready);
  const settled = vi.fn();
  const action = buildRaycastHandler()().then(settled);
  await vi.advanceTimersByTimeAsync(0);
  expect(settled).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(50);
  expect(settled).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(50);
  await action;
  expect(settled).toHaveBeenCalledOnce();
  expect(spawn).toHaveBeenCalledWith(["/usr/bin/open", "-b", "com.raycast.macos"], {
    stdout: "ignore",
    stderr: "pipe",
    timeout: 5_000,
  });
});

test("focus on another app or Raycast's settings input does not count as readiness", () => {
  expect(isRaycastInputFocused({ ...ready, bundleId: "com.apple.finder" })).toBe(false);
  expect(isRaycastInputFocused({ ...ready, placeholder: "Search Settings" })).toBe(false);
  expect(isRaycastInputFocused({ ...ready, placeholder: undefined })).toBe(false);
  expect(isRaycastInputFocused({ ...ready, role: "AXStaticText" })).toBe(false);
  expect(isRaycastInputFocused({ ...ready, focused: false })).toBe(false);
  expect(
    isRaycastInputFocused({
      bundleId: ready.bundleId,
      role: "AXSearchField",
      description: "Search for apps and commands...",
      focused: true,
    }),
  ).toBe(true);
});

test("an already focused input resolves without an arbitrary delay", async () => {
  await expect(buildRaycastHandler()()).resolves.toBeUndefined();
  expect(readFocus).toHaveBeenCalledOnce();
});

test("Raycast's WebKit input exposes its label as a description with an empty placeholder", async () => {
  readFocus.mockResolvedValue({
    ...ready,
    placeholder: "",
    description: "Search for apps or commands…",
  });
  await expect(buildRaycastHandler()()).resolves.toBeUndefined();
  expect(readFocus).toHaveBeenCalledOnce();
});

test("launch completion is awaited before checking focus", async () => {
  let exit!: (code: number) => void;
  spawn.mockReturnValue({
    exited: new Promise<number>((resolve) => {
      exit = resolve;
    }),
    stderr: new Response("").body,
  });
  const action = buildRaycastHandler()();
  await vi.advanceTimersByTimeAsync(100);
  expect(readFocus).not.toHaveBeenCalled();
  exit(0);
  await action;
  expect(readFocus).toHaveBeenCalledOnce();
});

test("the deadline includes launch time and rejects when focus never arrives", async () => {
  let exit!: (code: number) => void;
  spawn.mockReturnValue({
    exited: new Promise<number>((resolve) => {
      exit = resolve;
    }),
    stderr: new Response("").body,
  });
  readFocus.mockResolvedValue({});
  const rejected = expect(buildRaycastHandler(200)()).rejects.toThrow("within 200ms");
  await vi.advanceTimersByTimeAsync(150);
  exit(0);
  await vi.advanceTimersByTimeAsync(50);
  await rejected;
  expect(readFocus).toHaveBeenCalledOnce();
});

test("launch failures preserve the exit status and stderr", async () => {
  spawn.mockImplementation(() => launchResult(1, "Raycast is not installed\n"));
  await expect(buildRaycastHandler()()).rejects.toThrow(
    "Unable to open Raycast (exit 1): Raycast is not installed",
  );
  expect(readFocus).not.toHaveBeenCalled();
});

test("spawn and accessibility failures reject instead of reporting success", async () => {
  spawn.mockImplementationOnce(() => {
    throw new Error("Unable to spawn open");
  });
  const handler = buildRaycastHandler();
  await expect(handler()).rejects.toThrow("Unable to spawn open");
  readFocus.mockRejectedValueOnce(new Error("Chord needs Accessibility access"));
  await expect(handler()).rejects.toThrow("Chord needs Accessibility access");
  await expect(handler()).resolves.toBeUndefined();
});

test("concurrent invocations share a launch and later invocations can launch again", async () => {
  readFocus.mockResolvedValueOnce({}).mockResolvedValue(ready);
  const handler = buildRaycastHandler();
  const first = handler();
  const second = handler();
  expect(first).toBe(second);
  expect(spawn).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(50);
  await Promise.all([first, second]);
  await handler();
  expect(spawn).toHaveBeenCalledTimes(2);
});

test.each([0, -1, 1.5, NaN, Infinity])("rejects an invalid focus timeout: %s", (timeout) => {
  expect(() => buildRaycastHandler(timeout)).toThrow("positive integer");
});
