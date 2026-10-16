import { beforeEach, expect, mock, test } from "bun:test";
import { waitFor } from "@keychord/chordtest/test";
import { chordPattern } from "@keychord/chordtest/patterns";
import type { NavigationAction } from "../src/js/navigation";

const perform = mock();
const click = mock();
const getAppWindows = mock();
mock.module("../src/js/navigation.node", () => ({ default: { perform } }));
mock.module("chord", () => ({ click, getAppWindows }));
const { default: buildHandler } = await import("../src/js/navigation");
const { chords } = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, { "@input:navigation"?: [NavigationAction, string?] }> };

beforeEach(() => {
  perform.mockReset().mockResolvedValue("");
  click.mockReset().mockResolvedValue(undefined);
  getAppWindows.mockReset().mockReturnValue([]);
});

test.each([
  ["[[", "PREVIOUS"],
  ["]]", "NEXT"],
  ["[x", "CLOSE"],
  ["]1", "OPTION", 1],
  ["]12", "OPTION", 12],
] as const)("%s resolves uniquely and targets the captured app", async (input, action, index) => {
  const matches = Object.entries(chords).filter(
    ([pattern]) => !pattern.startsWith("?") && chordPattern(pattern).test(input),
  );
  expect(matches).toHaveLength(1);
  const [pattern, binding] = matches[0];
  const args = binding["@input:navigation"]!;
  const capture = chordPattern(pattern).exec(input)?.[1];
  await buildHandler().call({ focusedAppId: "dev.fixture" }, args[0], capture ?? args[1]);
  expect(perform).toHaveBeenCalledWith(
    "dev.fixture",
    JSON.stringify({ action, ...(index === undefined ? {} : { index }) }),
  );
});

test.each([undefined, 0, -1, 1.5, "01", "2junk", "9007199254740992", Infinity, NaN])(
  "invalid option %s makes no native call",
  async (index) => {
    await expect(buildHandler("dev.fixture")("OPTION", index)).rejects.toThrow(
      "positive safe integer",
    );
    expect(perform).not.toHaveBeenCalled();
  },
);

test("unknown actions and missing captured apps never touch the desktop", async () => {
  await expect(buildHandler()("NEXT")).rejects.toThrow("focused application");
  await expect(buildHandler("dev.fixture")("toString" as NavigationAction)).rejects.toThrow(
    "Unknown navigation action",
  );
  expect(perform).not.toHaveBeenCalled();
});

test("queued invocations retain their app and recover after a failure", async () => {
  let reject!: (error: Error) => void;
  perform.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const handler = buildHandler();
  const first = handler.call({ focusedAppId: "dev.first" }, "NEXT");
  const failure = first.catch((error: unknown) => error);
  const second = handler.call({ focusedAppId: "dev.second" }, "CLOSE");
  await waitFor(() => expect(perform).toHaveBeenCalledTimes(1));
  reject(new Error("disabled"));
  expect(String(await failure)).toContain("disabled");
  await second;
  expect(perform.mock.calls.map(([app]) => app)).toEqual(["dev.first", "dev.second"]);
});

test.each(["OK", "MOVED", "REPLACED", "AMBIGUOUS"])(
  "%s resolved click validates its app window",
  async (state) => {
    const bounds = { x: 100, y: 200, width: 600, height: 700 };
    perform.mockResolvedValue(JSON.stringify({ processId: 42, point: { x: 250, y: 420 }, bounds }));
    const window = {
      windowId: 12,
      processId: state === "REPLACED" ? 43 : 42,
      bounds: { ...bounds, x: state === "MOVED" ? 110 : 100 },
    };
    getAppWindows.mockReturnValue(state === "AMBIGUOUS" ? [window, window] : [window]);
    const action = buildHandler("dev.fixture")("NEXT");
    if (state === "OK") {
      await action;
      expect(click).toHaveBeenCalledWith({ windowId: 12, x: 150, y: 220, expectedBounds: bounds });
    } else {
      await expect(action).rejects.toThrow("moved or is unavailable");
      expect(click).not.toHaveBeenCalled();
    }
  },
);
