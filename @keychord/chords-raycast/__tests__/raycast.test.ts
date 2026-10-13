import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { chordPattern } from "@keychord/chordtest/patterns";
import buildRaycastHandler, { isRaycastInputFocused } from "../src/js/raycast";

const { readState, setSearch, activateSearch, returnRoot } = vi.hoisted(() => ({
  readState: vi.fn(),
  setSearch: vi.fn(),
  activateSearch: vi.fn(),
  returnRoot: vi.fn(),
}));
vi.mock("../src/js/utils/native", () => ({
  readRaycastState: readState,
  setRaycastSearch: setSearch,
  activateRaycastSearch: activateSearch,
  returnToRaycastRoot: returnRoot,
}));

const ready = {
  bundleId: "com.raycast.macos",
  role: "AXTextField",
  placeholder: "Search for apps or commands…",
  focused: true,
  value: "",
  rootSearchVisible: true,
  busy: false,
  fingerprint: "old results",
};
let state: Record<string, unknown>;
const spawn = vi.fn();

function launchResult(exitCode = 0, stderr = "") {
  return { exited: Promise.resolve(exitCode), stderr: new Response(stderr).body };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  spawn.mockReset().mockImplementation(() => launchResult());
  state = { ...ready };
  returnRoot.mockReset().mockImplementation(async () => {
    state = { ...ready };
    return true;
  });
  readState.mockReset().mockImplementation(async () => state);
  setSearch.mockReset().mockImplementation(async (query: string) => {
    state = { ...ready, value: query, fingerprint: `results:${query}` };
  });
  activateSearch.mockReset().mockImplementation(async () => {
    state = { bundleId: "com.apple.calculator", rootSearchVisible: false };
    return true;
  });
  vi.stubGlobal("Bun", {
    spawn,
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("// captures the entire query and loads the TypeScript handler's generated module", () => {
  const source = readFileSync(
    new URL("../chords/com/raycast/macos/macos.toml", import.meta.url),
    "utf8",
  );
  expect(source).toMatch(/\[on\.raycast\]\s+file = "raycast\.js"/);
  const binding = source.match(/^'([^']+)' = .*'@input:raycast' = \['(\$1)'\]/m);
  expect(binding).not.toBeNull();
  const pattern = chordPattern(binding![1]);
  for (const query of ["", "calculator", "1+2", "foo/bar.(baz)", "'quoted'", "café 🧮"]) {
    expect(pattern.exec(`//${query}`)?.[1]).toBe(query);
  }
  for (const input of ["/r", "/calculator", "calculator", "x//calculator"]) {
    expect(pattern.test(input)).toBe(false);
  }
  expect(source).not.toContain("shell =");
});

test("app activation alone leaves the Promise pending until the search input gets focus", async () => {
  readState
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
  expect(readState).toHaveBeenCalledOnce();
  expect(setSearch).not.toHaveBeenCalled();
  expect(activateSearch).not.toHaveBeenCalled();
});

test("Raycast's WebKit input exposes its label as a description with an empty placeholder", async () => {
  readState.mockResolvedValue({
    ...ready,
    placeholder: "",
    description: "Search for apps or commands…",
  });
  await expect(buildRaycastHandler()()).resolves.toBeUndefined();
  expect(readState).toHaveBeenCalledOnce();
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
  expect(readState).not.toHaveBeenCalled();
  exit(0);
  await action;
  expect(readState).toHaveBeenCalledOnce();
});

test("the deadline includes launch time and rejects when focus never arrives", async () => {
  let exit!: (code: number) => void;
  spawn.mockReturnValue({
    exited: new Promise<number>((resolve) => {
      exit = resolve;
    }),
    stderr: new Response("").body,
  });
  readState.mockResolvedValue({});
  const rejected = expect(buildRaycastHandler(200)()).rejects.toThrow("within 200ms");
  await vi.advanceTimersByTimeAsync(150);
  exit(0);
  await vi.advanceTimersByTimeAsync(50);
  await rejected;
  expect(readState).toHaveBeenCalledOnce();
});

test("launch failures preserve the exit status and stderr", async () => {
  spawn.mockImplementation(() => launchResult(1, "Raycast is not installed\n"));
  await expect(buildRaycastHandler()()).rejects.toThrow(
    "Unable to open Raycast (exit 1): Raycast is not installed",
  );
  expect(readState).not.toHaveBeenCalled();
});

test("spawn and accessibility failures reject instead of reporting success", async () => {
  spawn.mockImplementationOnce(() => {
    throw new Error("Unable to spawn open");
  });
  const handler = buildRaycastHandler();
  await expect(handler()).rejects.toThrow("Unable to spawn open");
  readState.mockRejectedValueOnce(new Error("Chord needs Accessibility access"));
  await expect(handler()).rejects.toThrow("Chord needs Accessibility access");
  await expect(handler()).resolves.toBeUndefined();
});

test("concurrent invocations share a launch and later invocations can launch again", async () => {
  readState.mockResolvedValueOnce({}).mockResolvedValue(ready);
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

test("atomic text entry waits for updated results and confirms activation", async () => {
  const query = "foo/bar.(baz)'🧮";
  setSearch.mockImplementation(async () => {
    state = { ...ready, value: query }; // Input changed; results are still stale.
  });
  const settled = vi.fn();
  const action = buildRaycastHandler()(query).then(settled);
  await vi.advanceTimersByTimeAsync(150);
  expect(setSearch).toHaveBeenCalledExactlyOnceWith(query, expect.any(Number));
  expect(activateSearch).not.toHaveBeenCalled();
  state = { ...ready, value: query, fingerprint: "updated results", busy: true };
  await vi.advanceTimersByTimeAsync(150);
  expect(activateSearch).not.toHaveBeenCalled();
  state.busy = false;
  await vi.advanceTimersByTimeAsync(100);
  await action;
  expect(activateSearch).toHaveBeenCalledExactlyOnceWith(
    query,
    "updated results",
    expect.any(Number),
  );
  expect(settled).toHaveBeenCalledOnce();
});

test("a result change between readiness and AXPress restarts observation", async () => {
  activateSearch.mockImplementationOnce(async () => {
    state.fingerprint = "new ranking";
    return false;
  });
  const action = buildRaycastHandler()("calculator");
  await vi.runAllTimersAsync();
  await action;
  expect(activateSearch).toHaveBeenNthCalledWith(
    1,
    "calculator",
    "results:calculator",
    expect.any(Number),
  );
  expect(activateSearch).toHaveBeenNthCalledWith(
    2,
    "calculator",
    "new ranking",
    expect.any(Number),
  );
});

test("repeating an already populated query resets the previous result selection", async () => {
  state = { ...ready, value: "calculator" };
  const action = buildRaycastHandler()("calculator");
  await vi.runAllTimersAsync();
  await action;
  expect(setSearch).toHaveBeenNthCalledWith(1, "", expect.any(Number));
  expect(setSearch).toHaveBeenNthCalledWith(2, "calculator", expect.any(Number));
  expect(activateSearch).toHaveBeenCalledExactlyOnceWith(
    "calculator",
    "results:calculator",
    expect.any(Number),
  );
});

test("a command view appearing inside Raycast confirms activation", async () => {
  activateSearch.mockImplementation(async () => {
    state = { ...ready, rootSearchVisible: false, placeholder: "Search Calculator History" };
    return true;
  });
  const action = buildRaycastHandler()("calculator history");
  await vi.runAllTimersAsync();
  await action;
});

test("an action that leaves root search unchanged is not silently reported as success or pressed twice", async () => {
  activateSearch.mockResolvedValue(true);
  const rejected = expect(buildRaycastHandler(300)("calculator")).rejects.toThrow(
    "activation was not confirmed",
  );
  await vi.advanceTimersByTimeAsync(300);
  await rejected;
  expect(activateSearch).toHaveBeenCalledOnce();
});

test("an unreadable window is not mistaken for confirmed activation", async () => {
  activateSearch.mockImplementation(async () => {
    state = { bundleId: "com.raycast.macos" };
    return true;
  });
  const rejected = expect(buildRaycastHandler(300)("calculator")).rejects.toThrow(
    "activation was not confirmed",
  );
  await vi.runAllTimersAsync();
  await rejected;
  expect(activateSearch).toHaveBeenCalledOnce();
});

test("a slow native read cannot dispatch text after the overall deadline", async () => {
  readState.mockImplementation(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
    return ready;
  });
  const rejected = expect(buildRaycastHandler(200)("calculator")).rejects.toThrow("within 200ms");
  await vi.runAllTimersAsync();
  await rejected;
  expect(setSearch).not.toHaveBeenCalled();
  expect(activateSearch).not.toHaveBeenCalled();
});

test("losing focus after the query is set rejects before activating", async () => {
  setSearch.mockImplementation(async () => {
    state = { bundleId: "com.apple.finder" };
  });
  await expect(buildRaycastHandler()("calculator")).rejects.toThrow("lost focus");
  expect(activateSearch).not.toHaveBeenCalled();
});

test("a missing letter never launches the wrong query", async () => {
  setSearch.mockImplementation(async () => {
    state = { ...ready, value: "alculator", fingerprint: "wrong results" };
  });
  const rejected = expect(buildRaycastHandler(200)("calculator")).rejects.toThrow(
    "results did not become ready",
  );
  await vi.advanceTimersByTimeAsync(200);
  await rejected;
  expect(activateSearch).not.toHaveBeenCalled();
});

test("duplicate queries share an action and different queries run in order", async () => {
  const handler = buildRaycastHandler();
  const first = handler("calculator");
  expect(handler("calculator")).toBe(first);
  const second = handler("calendar");
  await vi.advanceTimersByTimeAsync(0);
  expect(setSearch).toHaveBeenCalledExactlyOnceWith("calculator", expect.any(Number));
  // Each subsequent open puts Raycast back in the foreground.
  spawn.mockImplementation(() => {
    state = { ...ready };
    return launchResult();
  });
  await vi.runAllTimersAsync();
  await Promise.all([first, second]);
  expect(setSearch).toHaveBeenNthCalledWith(2, "calendar", expect.any(Number));
  expect(activateSearch).toHaveBeenCalledTimes(2);
});

test("native failures propagate and a queued query can recover", async () => {
  setSearch.mockRejectedValueOnce(new Error("AX write failed"));
  const handler = buildRaycastHandler();
  const rejected = expect(handler("calculator")).rejects.toThrow("AX write failed");
  const next = handler("calendar");
  await vi.runAllTimersAsync();
  await Promise.all([rejected, next]);
  expect(activateSearch).toHaveBeenCalledExactlyOnceWith(
    "calendar",
    "results:calendar",
    expect.any(Number),
  );
});

test("a configured command uses the official deeplink without loading the Accessibility path", async () => {
  const link =
    "raycast://extensions/raycast/clipboard-history/clipboard-history?launchType=background";
  await buildRaycastHandler(5_000, { clips: link })("clips");
  expect(spawn).toHaveBeenCalledExactlyOnceWith(
    ["/usr/bin/open", link],
    expect.objectContaining({ timeout: 5_000 }),
  );
  expect(readState).not.toHaveBeenCalled();
  expect(setSearch).not.toHaveBeenCalled();
  expect(activateSearch).not.toHaveBeenCalled();
});

test("an explicit Raycast command URL launches directly with encoded arguments preserved", async () => {
  const link =
    "raycast://extensions/owner/extension/command?arguments=%7B%22query%22%3A%22a%26b%22%7D";
  await buildRaycastHandler()(link);
  expect(spawn).toHaveBeenCalledWith(["/usr/bin/open", link], expect.anything());
  expect(readState).not.toHaveBeenCalled();
});

test("direct launch failures reject without a UI fallback that could execute twice", async () => {
  spawn.mockImplementation(() => launchResult(1, "URL delivery failed"));
  await expect(buildRaycastHandler()("raycast://extensions/a/b/c")).rejects.toThrow(
    "URL delivery failed",
  );
  expect(readState).not.toHaveBeenCalled();
});

test.each([
  "https://example.com",
  "raycast://search/query",
  "raycast://extensions/a/b",
  "raycast://user@extensions/a/b/c",
])("invalid direct command mappings reject before launching: %s", (link) => {
  expect(() => buildRaycastHandler(5_000, { test: link })).toThrow("command deeplink");
  expect(spawn).not.toHaveBeenCalled();
});

test("invalid query arguments reject before opening Raycast", async () => {
  await expect(buildRaycastHandler()(123 as unknown as string)).rejects.toThrow("must be a string");
  expect(spawn).not.toHaveBeenCalled();
});

test("an existing command view returns to Root Search before entering the query", async () => {
  state = {
    ...ready,
    rootSearchVisible: false,
    description: "Calculator History",
    placeholder: "Do math...",
    navigationFingerprint: "history view",
  };
  const action = buildRaycastHandler()("calculator");
  await vi.runAllTimersAsync();
  await action;
  expect(returnRoot).toHaveBeenCalledExactlyOnceWith("history view", expect.any(Number));
  expect(setSearch).toHaveBeenCalledExactlyOnceWith("calculator", expect.any(Number));
  expect(activateSearch).toHaveBeenCalledOnce();
});

test("a pending Back action is not repeated against the same view", async () => {
  state = {
    ...ready,
    rootSearchVisible: false,
    placeholder: "Do math...",
    navigationFingerprint: "history view",
  };
  returnRoot.mockResolvedValue(true);
  const rejected = expect(buildRaycastHandler(200)("calculator")).rejects.toThrow("within 200ms");
  await vi.runAllTimersAsync();
  await rejected;
  expect(returnRoot).toHaveBeenCalledOnce();
  expect(setSearch).not.toHaveBeenCalled();
});
