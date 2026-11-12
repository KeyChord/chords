import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { tap } from "chord";
import { chordPattern } from "@keychord/chordtest/patterns";
import { mocked } from "@keychord/chordtest/test";
import type { SpotlightSearch } from "../src/js/utils/native";

const calls: string[] = [];
const state = {
  supported: true,
  open: false,
  prepared: true,
  search: "ready" as SpotlightSearch,
  ready: true,
  closed: true,
  // Answers for consecutive calls, before falling back to the fields above.
  opens: [] as boolean[],
  searches: [] as SpotlightSearch[],
};
mock.module("../src/js/utils/native", () => ({
  isSpotlightSupported: async () => (calls.push("supported"), state.supported),
  isSpotlightPanelOpen: async () => (calls.push("isOpen"), state.opens.shift() ?? state.open),
  prepareSpotlight: async () => (calls.push("prepare"), state.prepared),
  searchSpotlight: async (query: string) => (
    calls.push(`search ${query}`),
    state.searches.shift() ?? state.search
  ),
  focusSpotlight: async (query: string) => (calls.push(`focus ${query}`), state.ready),
  awaitSpotlightClosed: async () => (calls.push("closed"), state.closed),
}));
const { default: buildSpotlightHandler } = await import("../src/js/spotlight");

const spawn = mock();
let restoreSpawn: () => void;

function launchResult(exitCode = 0, stderr = "") {
  return { exited: Promise.resolve(exitCode), stderr: new Response(stderr).body };
}

beforeEach(() => {
  calls.length = 0;
  Object.assign(state, {
    supported: true,
    open: false,
    prepared: true,
    search: "ready",
    ready: true,
    closed: true,
    opens: [],
    searches: [],
  });
  const spy = spyOn(Bun, "spawn").mockImplementation(((...args: unknown[]) => {
    calls.push("open");
    return spawn(...args);
  }) as never);
  restoreSpawn = () => spy.mockRestore();
  spawn.mockReset().mockImplementation(() => launchResult());
  mocked(tap)
    .mockReset()
    .mockImplementation((key: string) => void calls.push(`tap ${key}`));
});

afterEach(() => restoreSpawn());

test("/ captures the whole query as a fallback chord for the handler", () => {
  const source = readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8");
  expect(source).toMatch(/\[on\.spotlight\]\s+file = 'spotlight\.js'/);
  const binding = source.match(/^'([^']+)' = .*fallback = true, '@input:spotlight' = \['(\$1)'\]/m);
  expect(binding).not.toBeNull();
  const pattern = chordPattern(binding![1]);
  for (const query of ["", "calculator", "2+3", "foo/bar.(baz)", "café 🧮", "/x"]) {
    expect(pattern.exec(`/${query}`)?.[1]).toBe(query);
  }
  expect(pattern.test("calculator")).toBe(false);
});

test("opens the panel by URL, searches, and presses Return once the result is still selected", async () => {
  await buildSpotlightHandler()("calculator");
  expect(spawn).toHaveBeenCalledWith(
    ["/usr/bin/open", "-b", "com.apple.campo", "spotlight://apps"],
    {
      stdout: "ignore",
      stderr: "pipe",
      timeout: 5_000,
    },
  );
  expect(calls).toEqual([
    "supported",
    "isOpen",
    "open",
    "prepare",
    "search calculator",
    "focus calculator",
    "tap enter",
    "closed",
  ]);
});

test("an open panel is reused, because the URL would close it", async () => {
  state.open = true;
  await buildSpotlightHandler()("calculator");
  expect(spawn).not.toHaveBeenCalled();
  expect(calls).toContain("tap enter");
});

test("/ alone opens Spotlight without searching", async () => {
  await buildSpotlightHandler()("");
  expect(calls).toEqual(["supported", "isOpen", "open", "prepare"]);
});

test("macOS before 27 is reported without touching Spotlight", async () => {
  state.supported = false;
  const error = await buildSpotlightHandler()("calculator").then(undefined, (e) => e);
  expect(String(error)).toContain("needs macOS 27");
  expect(String(error)).toContain("@keychord/chords-raycast");
  expect(calls).toEqual(["supported"]);
});

for (const [name, setup, message] of [
  ["a panel that never opens", () => (state.prepared = false), "did not open"],
  ["only Finder and web searches", () => (state.search = "nothing"), "found nothing to open"],
  ["a search with no result in time", () => (state.search = "timeout"), "within 5000ms"],
  ["results that changed before Return", () => (state.ready = false), "changed before opening"],
] as const) {
  test(`${name} never presses Return`, async () => {
    setup();
    const error = await buildSpotlightHandler()("calculator").then(undefined, (e) => e);
    expect(String(error)).toContain(message);
    expect(tap).not.toHaveBeenCalled();
  });
}

test("a panel that stays open after Return is reported", async () => {
  state.closed = false;
  const error = await buildSpotlightHandler()("calculator").then(undefined, (e) => e);
  expect(String(error)).toContain("did not open its result");
  expect(calls).toContain("tap enter");
});

test("a failed open reports its error", async () => {
  spawn.mockImplementation(() => launchResult(1, "no such app\n"));
  const error = await buildSpotlightHandler()("calculator").then(undefined, (e) => e);
  expect(String(error)).toContain("Unable to open Spotlight (exit 1): no such app");
  expect(calls).not.toContain("prepare");
});

test("a repeated query shares one run and different queries run in order", async () => {
  const spotlight = buildSpotlightHandler();
  const first = spotlight("calculator");
  expect(spotlight("calculator")).toBe(first);
  const second = spotlight("safari");
  await Promise.all([first, second]);
  expect(calls.filter((call) => call.startsWith("search"))).toEqual([
    "search calculator",
    "search safari",
  ]);
  expect(calls.filter((call) => call === "tap enter")).toHaveLength(2);
});

test("the timeout must be a positive integer", () => {
  expect(() => buildSpotlightHandler(0)).toThrow(TypeError);
  expect(() => buildSpotlightHandler(1.5)).toThrow(TypeError);
});

test("a panel that closes mid-search, as after switching apps, is opened again once", async () => {
  state.opens = [true, false];
  state.searches = ["closed", "ready"];
  await buildSpotlightHandler()("calculator");
  expect(calls).toEqual([
    "supported",
    "isOpen",
    "prepare",
    "search calculator",
    "isOpen",
    "open",
    "prepare",
    "search calculator",
    "focus calculator",
    "tap enter",
    "closed",
  ]);
});

test("a panel that closes again is reported without pressing Return", async () => {
  state.search = "closed";
  const error = await buildSpotlightHandler()("calculator").then(undefined, (e) => e);
  expect(String(error)).toContain("closed its search before it finished");
  expect(calls.filter((call) => call === "open")).toHaveLength(2);
  expect(tap).not.toHaveBeenCalled();
});
