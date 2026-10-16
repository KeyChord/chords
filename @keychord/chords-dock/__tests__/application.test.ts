import { expect, mock, test } from "bun:test";
import { waitFor } from "@keychord/chordtest/test";
import buildApplicationHandler from "../src/js/application";

const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as {
  on: Record<string, { file: string }>;
  chords: Record<string, { "@input:application"?: [string]; shortcut?: string }>;
};

test.each([
  ["/dw[", "PREVIOUS"],
  ["/dw]", "NEXT"],
])("%s cycles applications natively from the captured app", async (input, direction) => {
  const cycleApplication = mock().mockResolvedValue(undefined);
  mock.module("../src/js/application.node", () => ({ default: { cycleApplication } }));
  const binding = definition.chords[input];
  expect(binding.shortcut).toBeUndefined();
  expect(binding["@input:application"]).toEqual([direction]);
  expect(definition.on.application.file).toBe("application.js");
  await buildApplicationHandler().call(
    { focusedAppId: "dev.fixture" },
    ...binding["@input:application"]!,
  );
  expect(cycleApplication).toHaveBeenCalledWith("dev.fixture", direction);
  expect(definition.chords["/d["]).toBeUndefined();
  expect(definition.chords["/d]"]).toBeUndefined();
});

test("invalid directions never call native code and failed switches leave the queue usable", async () => {
  const cycleApplication = mock()
    .mockRejectedValueOnce(new Error("Focus failed"))
    .mockResolvedValue(undefined);
  mock.module("../src/js/application.node", () => ({ default: { cycleApplication } }));
  const handler = buildApplicationHandler();
  await expect(handler("SIDEWAYS")).rejects.toThrow(TypeError);
  expect(cycleApplication).not.toHaveBeenCalled();
  await expect(handler("NEXT")).rejects.toThrow("Focus failed");
  await handler("PREVIOUS");
  expect(cycleApplication).toHaveBeenLastCalledWith(undefined, "PREVIOUS");
});

test("overlapping switches are serialized and retain their captured contexts", async () => {
  let finish!: () => void;
  const cycleApplication = mock()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  mock.module("../src/js/application.node", () => ({ default: { cycleApplication } }));
  const handler = buildApplicationHandler();
  const first = handler.call({ focusedAppId: "first" }, "NEXT");
  const second = handler.call({ focusedAppId: "second" }, "PREVIOUS");
  await waitFor(() => expect(cycleApplication).toHaveBeenCalledTimes(1));
  finish();
  await Promise.all([first, second]);
  expect(cycleApplication.mock.calls).toEqual([
    ["first", "NEXT"],
    ["second", "PREVIOUS"],
  ]);
});
