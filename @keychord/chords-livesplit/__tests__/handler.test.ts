import { beforeEach, expect, mock, test } from "bun:test";
import { buildLiveSplitJavaScript } from "../src/js/livesplit/page";

const runLiveSplitJavaScript = mock(
  (_body: string, _options: { processName: string; library: string }): Promise<unknown> =>
    Promise.resolve('{"ok":true,"milliseconds":true}'),
);
mock.module("../src/js/livesplit/bridge", () => ({ runLiveSplitJavaScript }));
const { default: buildHandler } = await import("../src/js/livesplit");

const bridgePath = "target/aarch64-apple-darwin/livesplit-bridge/livesplit-bridge.dylib";

beforeEach(() => {
  runLiveSplitJavaScript.mockClear();
  runLiveSplitJavaScript.mockImplementation(() =>
    Promise.resolve('{"ok":true,"milliseconds":true}'),
  );
});

test("v,tm toggles milliseconds in LiveSplit One", async () => {
  // Chord discovers app bindings at chords/<app id segments>/macos.toml. The bare release
  // executable has no bundle ID, so the file claims it by name for its bundle's app ID.
  const path = new URL("../chords/org/livesplit/one/macos.toml", import.meta.url);
  // Chord uses Bun's TOML parser, so validate the actual host format.
  const bindings = Bun.TOML.parse(await Bun.file(path).text()) as Record<string, unknown>;
  expect(bindings).toEqual({
    name: "LiveSplit One",
    executables: ["LiveSplit One"],
    on: { livesplit: { file: "livesplit.js" } },
    chords: {
      "v,tm": {
        name: "Vary Setting: Time Milliseconds",
        "@input:livesplit": ["TOGGLE_MILLISECONDS"],
      },
    },
  });

  expect(await buildHandler()("TOGGLE_MILLISECONDS")).toBe(true);
  expect(runLiveSplitJavaScript).toHaveBeenCalledWith(
    buildLiveSplitJavaScript("TOGGLE_MILLISECONDS"),
    { processName: "LiveSplit One", library: expect.stringMatching(new RegExp(`/${bridgePath}$`)) },
  );
});

test("the built handler loads the committed bridge library", async () => {
  const built = await Bun.file(new URL("../js/livesplit.js", import.meta.url)).text();
  const reference = /new URL\("([^"]+)", import\.meta\.url\)/.exec(built)?.[1];
  expect(reference).toBe(`../${bridgePath}`);
  const library = new URL(reference!, new URL("../js/livesplit.js", import.meta.url));
  expect(await Bun.file(library).exists()).toBe(true);
});

test("targets a configured LiveSplit One executable name", async () => {
  await buildHandler("LiveSplit One Nightly")("TOGGLE_MILLISECONDS");
  expect(runLiveSplitJavaScript.mock.calls[0]![1].processName).toBe("LiveSplit One Nightly");
  for (const name of ["", "  ", "/Applications/LiveSplit One", 5]) {
    expect(() => buildHandler(name as string)).toThrow(
      "The LiveSplit One process name must be a non-empty executable name.",
    );
  }
});

test("reports page and bridge failures", async () => {
  const handler = buildHandler();
  runLiveSplitJavaScript.mockResolvedValueOnce(
    '{"ok":false,"error":"Close LiveSplit One\'s layout editor before toggling milliseconds."}',
  );
  await expect(handler("TOGGLE_MILLISECONDS")).rejects.toThrow(
    "Close LiveSplit One's layout editor before toggling milliseconds.",
  );
  runLiveSplitJavaScript.mockRejectedValueOnce(
    new Error("Open LiveSplit One before using LiveSplit chords."),
  );
  await expect(handler("TOGGLE_MILLISECONDS")).rejects.toThrow(
    "Open LiveSplit One before using LiveSplit chords.",
  );
  // A failed command does not block later ones.
  expect(await handler("TOGGLE_MILLISECONDS")).toBe(true);
  await expect(handler("RESET" as never)).rejects.toThrow("Unknown LiveSplit One action: RESET");
});

test("runs one command at a time so overlapping toggles do not race", async () => {
  const handler = buildHandler();
  const resolvers: ((value: string) => void)[] = [];
  runLiveSplitJavaScript.mockImplementation(
    () => new Promise<unknown>((resolve) => resolvers.push(resolve)),
  );
  const first = handler("TOGGLE_MILLISECONDS");
  const second = handler("TOGGLE_MILLISECONDS");
  await Bun.sleep(0);
  expect(runLiveSplitJavaScript).toHaveBeenCalledTimes(1);
  resolvers[0]!('{"ok":true}');
  expect(await first).toBe(true);
  await Bun.sleep(0);
  expect(runLiveSplitJavaScript).toHaveBeenCalledTimes(2);
  resolvers[1]!('{"ok":true}');
  expect(await second).toBe(true);
});
