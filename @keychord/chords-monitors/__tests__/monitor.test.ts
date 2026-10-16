import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, mock, test } from "bun:test";
import { chordPattern } from "@keychord/chordtest/patterns";
import { waitFor } from "@keychord/chordtest/test";
import buildMonitorHandler from "../src/js/monitor";

const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as {
  on: Record<string, { file: string }>;
  chords: Record<string, { "@input:monitor"?: [string, string?]; shortcut?: string }>;
};

test.each([
  ["/m1", "1"],
  ["/m12", "12"],
  ["/m[", "PREVIOUS"],
  ["/m]", "NEXT"],
  ["/ml", "LEFT"],
  ["/mr", "RIGHT"],
  ["/mt", "UP"],
  ["/mb", "DOWN"],
])("%s resolves one monitor action", async (input, expected) => {
  const native = mock().mockResolvedValue(undefined);
  mock.module("../src/js/monitor.node", () => ({ default: { focusMonitor: native } }));
  const matches = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
    const captures = chordPattern(pattern).exec(input);
    const args = binding["@input:monitor"];
    return captures && args ? [args[0].replace(/\$(\d+)/g, (_, i) => captures[Number(i)])] : [];
  });
  expect(matches).toEqual([expected]);
  await buildMonitorHandler()(matches[0]);
  expect(native).toHaveBeenCalledTimes(1);
  expect(native).toHaveBeenCalledWith(expected);
  expect(definition.on.monitor.file).toBe("monitor.js");
});

test("invalid targets never reach native code; native failures reject and the queue recovers", async () => {
  const native = mock()
    .mockRejectedValueOnce(new Error("Monitor 2 does not exist"))
    .mockResolvedValue(undefined);
  mock.module("../src/js/monitor.node", () => ({ default: { focusMonitor: native } }));
  const handler = buildMonitorHandler();
  for (const target of ["", "0", "-1", "1.5", "01", "9007199254740992", "sideways"]) {
    await expect(handler(target)).rejects.toThrow(TypeError);
  }
  expect(native).not.toHaveBeenCalled();
  await expect(handler("2")).rejects.toThrow("does not exist");
  await handler("NEXT");
  expect(native).toHaveBeenCalledTimes(2);
});

test("monitor actions wait for the previous focus change before reading the pointer again", async () => {
  let finish!: () => void;
  const native = mock()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  mock.module("../src/js/monitor.node", () => ({ default: { focusMonitor: native } }));
  const handler = buildMonitorHandler();
  const first = handler("NEXT");
  const second = handler("NEXT");
  await waitFor(() => expect(native).toHaveBeenCalledTimes(1));
  finish();
  await Promise.all([first, second]);
  expect(native).toHaveBeenCalledTimes(2);
});

test("monitor focusing does not match minimize or invalid monitor numbers", () => {
  for (const input of ["/m", "/m0", "/m01", "/m-1", "/m2extra"]) {
    expect(
      Object.entries(definition.chords).some(
        ([pattern, binding]) => binding["@input:monitor"] && chordPattern(pattern).test(input),
      ),
    ).toBe(false);
  }
});

test.skipIf(process.platform !== "darwin")(
  "native monitor selection handles mixed display layouts and spanning windows",
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "chord-monitor-layout-"));
    try {
      const binary = join(scratch, "monitor-layout");
      execFileSync(
        "swiftc",
        [
          "-parse-as-library",
          fileURLToPath(
            new URL(
              "../Sources/KeychordChordsMonitorsNativeMonitor/MonitorLayout.swift",
              import.meta.url,
            ),
          ),
          fileURLToPath(new URL("./MonitorLayoutTests.swift", import.meta.url)),
          "-o",
          binary,
        ],
        { timeout: 60_000 },
      );
      expect(execFileSync(binary, { encoding: "utf8", timeout: 5_000 })).toContain(
        "monitor-layout-ok",
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
  65_000,
);

test.each([
  "0x200",
  "200x0",
  "22",
  ".5",
  "200x",
  "h200x",
  "-200x200",
  "200.5x200",
  "200x200x",
  "9007199254740992x200",
])("resolution %s is rejected before native code", async (expression) => {
  const resolution = mock().mockResolvedValue(undefined);
  mock.module("../src/js/monitor.node", () => ({ default: { setMonitorResolution: resolution } }));
  await expect(buildMonitorHandler()(expression, "SIZE")).rejects.toThrow(TypeError);
  expect(resolution).not.toHaveBeenCalled();
});

test("the native resolution API preserves the focus queue; /ms belongs to BetterDisplay", async () => {
  let finish!: () => void;
  const focus = mock().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const resolution = mock()
    .mockRejectedValueOnce(new Error("Unsupported monitor resolution"))
    .mockResolvedValue(undefined);
  mock.module("../src/js/monitor.node", () => ({
    default: { focusMonitor: focus, setMonitorResolution: resolution },
  }));
  const handler = buildMonitorHandler();
  const first = handler("NEXT");
  const changing = handler("2000x200", "SIZE");
  // Bun's `expect(promise).rejects` blocks until the promise settles; capture the error instead.
  const rejected = changing.then(
    () => undefined,
    (error: unknown) => error,
  );
  await waitFor(() => expect(focus).toHaveBeenCalledTimes(1));
  expect(resolution).not.toHaveBeenCalled();
  finish();
  await first;
  expect(await rejected).toHaveProperty("message", "Unsupported monitor resolution");
  await handler("1920x1080", "SIZE");
  expect(resolution.mock.calls).toEqual([
    [2000, 200],
    [1920, 1080],
  ]);
  expect(definition.chords["/ms(.+)"]).toBeUndefined();
  expect(definition.chords["?/ms"]).toBeUndefined();
});

test.skipIf(process.platform !== "darwin")(
  "native resolution selection preserves density and refresh rate and rejects unsupported modes",
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "chord-monitor-resolution-"));
    try {
      const binary = join(scratch, "modes");
      execFileSync(
        "swiftc",
        [
          "-parse-as-library",
          fileURLToPath(
            new URL(
              "../Sources/KeychordChordsMonitorsNativeMonitor/MonitorLayout.swift",
              import.meta.url,
            ),
          ),
          fileURLToPath(
            new URL(
              "../Sources/KeychordChordsMonitorsNativeMonitor/MonitorResolution.swift",
              import.meta.url,
            ),
          ),
          fileURLToPath(new URL("./MonitorResolutionTests.swift", import.meta.url)),
          "-o",
          binary,
        ],
        { timeout: 60_000 },
      );
      expect(execFileSync(binary, { encoding: "utf8", timeout: 5_000 })).toContain(
        "monitor-resolution-selection-ok",
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
  65_000,
);
