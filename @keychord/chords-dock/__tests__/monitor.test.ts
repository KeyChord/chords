import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { chordPattern } from "@keychord/chordtest/patterns";

const definition = JSON.parse(
  execFileSync(
    "bun",
    ["-e", "console.log(JSON.stringify(Bun.TOML.parse(await Bun.stdin.text())))"],
    {
      input: readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8"),
      encoding: "utf8",
    },
  ),
) as {
  on: Record<string, { file: string }>;
  chords: Record<string, { "@input:monitor"?: [string, string?]; shortcut?: string }>;
};

afterEach(() => {
  vi.doUnmock("../src/js/monitor.node");
  vi.resetModules();
});

test.each([
  ["/m1", "1"],
  ["/m12", "12"],
  ["/m[", "previous"],
  ["/m]", "next"],
  ["/ml", "left"],
  ["/mr", "right"],
  ["/mt", "up"],
  ["/mb", "down"],
])("%s resolves one monitor action", async (input, expected) => {
  const native = vi.fn().mockResolvedValue(undefined);
  vi.doMock("../src/js/monitor.node", () => ({ default: { focusMonitor: native } }));
  const { default: buildMonitorHandler } = await import("../src/js/monitor");
  const matches = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
    const captures = chordPattern(pattern).exec(input);
    const args = binding["@input:monitor"];
    return captures && args ? [args[0].replace(/\$(\d+)/g, (_, i) => captures[Number(i)])] : [];
  });
  expect(matches).toEqual([expected]);
  await buildMonitorHandler()(matches[0]);
  expect(native).toHaveBeenCalledExactlyOnceWith(expected);
  expect(definition.on.monitor.file).toBe("monitor.js");
});

test("invalid targets never reach native code; native failures reject and the queue recovers", async () => {
  const native = vi
    .fn()
    .mockRejectedValueOnce(new Error("Monitor 2 does not exist"))
    .mockResolvedValue(undefined);
  vi.doMock("../src/js/monitor.node", () => ({ default: { focusMonitor: native } }));
  const { default: buildMonitorHandler } = await import("../src/js/monitor");
  const handler = buildMonitorHandler();
  for (const target of ["", "0", "-1", "1.5", "01", "9007199254740992", "sideways"]) {
    await expect(handler(target)).rejects.toThrow(TypeError);
  }
  expect(native).not.toHaveBeenCalled();
  await expect(handler("2")).rejects.toThrow("does not exist");
  await handler("next");
  expect(native).toHaveBeenCalledTimes(2);
});

test("monitor actions wait for the previous focus change before reading the pointer again", async () => {
  let finish!: () => void;
  const native = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  vi.doMock("../src/js/monitor.node", () => ({ default: { focusMonitor: native } }));
  const { default: buildMonitorHandler } = await import("../src/js/monitor");
  const handler = buildMonitorHandler();
  const first = handler("next");
  const second = handler("next");
  await vi.waitFor(() => expect(native).toHaveBeenCalledTimes(1));
  finish();
  await Promise.all([first, second]);
  expect(native).toHaveBeenCalledTimes(2);
});

test("Space chords use Mission Control shortcuts and preserve minimize", () => {
  for (const input of ["/s[", "/sl"]) expect(definition.chords[input].shortcut).toBe("ctrl+left");
  for (const input of ["/s]", "/sr"]) expect(definition.chords[input].shortcut).toBe("ctrl+right");
  for (let index = 1; index <= 9; index++)
    expect(definition.chords[`/s${index}`].shortcut).toBe(`ctrl+${index}`);
  expect(definition.chords["/m"].shortcut).toBe("cmd+m");
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
              "../Sources/KeychordChordsDockNativeMonitor/MonitorLayout.swift",
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
  const resolution = vi.fn().mockResolvedValue(undefined);
  vi.doMock("../src/js/monitor.node", () => ({ default: { setMonitorResolution: resolution } }));
  const { default: buildMonitorHandler } = await import("../src/js/monitor");
  await expect(buildMonitorHandler()(expression, "size")).rejects.toThrow(TypeError);
  expect(resolution).not.toHaveBeenCalled();
});

test("the native resolution API preserves the focus queue; /ms belongs to BetterDisplay", async () => {
  let finish!: () => void;
  const focus = vi.fn().mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const resolution = vi
    .fn()
    .mockRejectedValueOnce(new Error("Unsupported monitor resolution"))
    .mockResolvedValue(undefined);
  vi.doMock("../src/js/monitor.node", () => ({
    default: { focusMonitor: focus, setMonitorResolution: resolution },
  }));
  const { default: buildMonitorHandler } = await import("../src/js/monitor");
  const handler = buildMonitorHandler();
  const first = handler("next");
  const changing = handler("2000x200", "size");
  const rejected = expect(changing).rejects.toThrow("Unsupported monitor resolution");
  await vi.waitFor(() => expect(focus).toHaveBeenCalledTimes(1));
  expect(resolution).not.toHaveBeenCalled();
  finish();
  await first;
  await rejected;
  await handler("1920x1080", "size");
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
              "../Sources/KeychordChordsDockNativeMonitor/MonitorLayout.swift",
              import.meta.url,
            ),
          ),
          fileURLToPath(
            new URL(
              "../Sources/KeychordChordsDockNativeMonitor/MonitorResolution.swift",
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
