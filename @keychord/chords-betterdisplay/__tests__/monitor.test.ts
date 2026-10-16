import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, mock, spyOn, test } from "bun:test";
import { chordPattern } from "@keychord/chordtest/patterns";
import {
  advanceTimersByTimeAsync,
  runAllTimersAsync,
  useFakeTimers,
  useRealTimers,
  waitFor,
} from "@keychord/chordtest/test";
import {
  BetterDisplayError,
  createMonitorHandler,
  parseMonitorResolution,
} from "../src/js/monitor";

const target = "37D8832A-2D66-02CA-B9F7-8F30A301B230";
const other = "11111111-2222-3333-4444-555555555555";
const missing = () => new BetterDisplayError("BetterDisplay get failed: Failed.", true);
type Virtual = {
  tagID: string;
  name: string;
  resolution: string;
  connected: boolean;
  requestedResolution?: string;
  hiDPI?: boolean;
  mirror?: string;
};

/** Model the CLI's observable state, including duplicate pointer identifiers under mirroring. */
function betterDisplay() {
  let native = "1728x1117";
  const screens: Virtual[] = [
    { tagID: "10", name: "My screen", resolution: "800x600", connected: false },
    {
      tagID: "11",
      name: `Chord /md ${other} 800x600 ${other}`,
      resolution: "800x600",
      connected: false,
    },
  ];
  let next = 12;
  const command = mock(async (args: string[]): Promise<string> => {
    const [operation] = args;
    if (args.includes("--proAvailable")) return "on";
    const value = (key: string) =>
      args.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
    const active = () => screens.find((entry) => entry.connected && entry.mirror === target);
    const selected = () =>
      screens.find((entry) => entry.tagID === value("tagID") || entry.name === value("name"));
    if (operation === "create") {
      screens.push({
        tagID: String(next++),
        name: value("virtualScreenName")!,
        resolution: value("resolutionList")!,
        requestedResolution: value("resolutionList")!,
        hiDPI: true,
        connected: false,
      });
      return "";
    }
    if (operation === "discard") {
      const index = screens.indexOf(selected()!);
      if (index < 0) throw missing();
      screens.splice(index, 1);
      return "";
    }
    if (args.includes("--displayWithMouse")) {
      if (value("type") === "Display") {
        if (active()) throw missing();
        return target;
      }
      if (!active()) throw missing();
      return `${active()!.name},${active()!.name}`;
    }
    if (args.includes("--identifiers")) {
      return screens
        .map((entry) => JSON.stringify({ ...entry, deviceType: "VirtualScreen" }))
        .join(",");
    }
    if (value("type") === "Display") {
      if (value("UUID") !== target) throw missing();
      if (args.includes("--resolution")) return active()?.resolution ?? native;
      if (args.includes("--displayModeList"))
        return "0 - 1728x1117 HiDPI Current\n1 - 1920x1200 HiDPI";
      if (operation === "set" && value("resolution")) {
        native = value("resolution")!;
        return "";
      }
    }
    const entry = selected();
    if (!entry) throw missing();
    if (operation === "get") {
      if (args.includes("--resolution")) return entry.resolution;
      if (args.includes("--hiDPI")) return entry.hiDPI ? "on,on" : "off,off";
      if (args.includes("--connected")) return entry.connected ? "on,on" : "off,off";
      if (args.includes("--mirror"))
        return entry.connected && entry.mirror === value("targetUUID") ? "on" : "off";
    }
    if (operation === "set") {
      if (value("connected")) {
        entry.connected = value("connected") === "on";
        // Match the real 720x864 failure: reconnect initially selects the
        // doubled LoDPI desktop, despite the requested HiDPI mode existing.
        if (entry.connected && entry.requestedResolution === "720x864") {
          entry.resolution = "1440x1728";
          entry.hiDPI = false;
        }
      }
      if (value("resolution")) entry.resolution = value("resolution")!;
      if (value("hiDPI")) entry.hiDPI = value("hiDPI") === "on";
      if (value("mirror") === "on") entry.mirror = value("targetUUID");
      return "";
    }
    throw new Error(`Unexpected CLI invocation: ${JSON.stringify(args)}`);
  });
  return {
    command,
    screens,
    resolution: () => screens.find((s) => s.connected && s.mirror === target)?.resolution ?? native,
  };
}

test.each([
  "reset",
  "0x200",
  "200x0",
  "22",
  ".5",
  "200x",
  "-200x200",
  "200.5x200",
  "200x200x",
  "9007199254740992x200",
  "16385x200",
  "1920x1080;touch /tmp/no",
])("invalid resolution %s cannot reach BetterDisplay", async (input) => {
  const { command } = betterDisplay();
  await expect(createMonitorHandler(command)(input)).rejects.toThrow();
  expect(command).not.toHaveBeenCalled();
});

test("absolute sizes retain arbitrary aspect ratios", () => {
  expect(parseMonitorResolution(" 1440x1728 ")).toBe("1440x1728");
  expect(parseMonitorResolution("2000x200")).toBe("2000x200");
});

test("the BetterDisplay package owns /md, including exactly one reset binding", () => {
  const parse = (file: URL) => Bun.TOML.parse(readFileSync(file, "utf8")) as any;
  const definition = parse(new URL("../chords/macos.toml", import.meta.url));
  const monitors = parse(new URL("../../chords-monitors/chords/macos.toml", import.meta.url));
  expect(definition.on.monitor.file).toBe("monitor.js");
  for (const input of ["/md1440x1728", "/md0"]) {
    const matches = Object.entries(definition.chords).filter(
      ([pattern, binding]) =>
        (binding as Record<string, unknown>)["@input:monitor"] && chordPattern(pattern).test(input),
    );
    expect(matches).toHaveLength(1);
  }
  expect(monitors.chords["/md(.+)"]).toBeUndefined();
  expect(monitors.chords["?/md"]).toBeUndefined();
});

test("available modes use the physical display and current dimensions are a no-op", async () => {
  const state = betterDisplay();
  const handler = createMonitorHandler(state.command);
  await handler("1728x1117");
  expect(state.command.mock.calls.every(([args]) => args[0] === "get")).toBe(true);
  await handler("1920x1200");
  expect(state.resolution()).toBe("1920x1200");
  expect(state.screens).toHaveLength(2);
  expect(state.command.mock.calls.some(([args]) => args[0] === "create")).toBe(false);
});

test("an unavailable size creates and verifies a Retina mirror; a fresh handler can replace or reset it", async () => {
  const state = betterDisplay();
  await createMonitorHandler(state.command)("1440x1728");
  expect(state.resolution()).toBe("1440x1728");
  const create = state.command.mock.calls.find(([args]) => args[0] === "create")![0];
  expect(create).toContain("--virtualScreenHiDPI=on");
  expect(create).toContain("--resolutionList=1440x1728");
  expect(state.screens[2].name).toStartWith(`Chord /md ${target} `);
  await createMonitorHandler(state.command)("2000x200");
  expect(state.resolution()).toBe("2000x200");
  expect(state.screens).toHaveLength(3);
  await createMonitorHandler(state.command)("0");
  expect(state.resolution()).toBe("1728x1117");
  expect(state.screens.map((entry) => entry.tagID)).toEqual(["10", "11"]);
});

test("virtual screens created before the /md rename can still be targeted and reset", async () => {
  const state = betterDisplay();
  await createMonitorHandler(state.command)("1440x1728");
  state.screens[2].name = state.screens[2].name.replace("/md", "/ms");
  await createMonitorHandler(state.command)("0");
  expect(state.resolution()).toBe("1728x1117");
  expect(state.screens.map((entry) => entry.tagID)).toEqual(["10", "11"]);
});

test("switching from a custom mirror to a native mode removes only this display's managed screen", async () => {
  const state = betterDisplay();
  const handler = createMonitorHandler(state.command);
  await handler("1440x1728");
  await handler("1920x1200");
  expect(state.resolution()).toBe("1920x1200");
  expect(state.screens.map((entry) => entry.tagID)).toEqual(["10", "11"]);
});

test("a small virtual desktop explicitly selects HiDPI instead of its doubled startup mode", async () => {
  const state = betterDisplay();
  await createMonitorHandler(state.command)("720x864");
  expect(state.resolution()).toBe("720x864");
  expect(state.screens[2].hiDPI).toBe(true);
  const selection = state.command.mock.calls.find(([args]) =>
    args.includes("--resolution=720x864"),
  )![0];
  expect(selection).toContain("--hiDPI=on");
});

test.each(["1440x1728", "720x864"])(
  "a failed replacement restores %s, including its mode after reconnection",
  async (previousResolution) => {
    const state = betterDisplay();
    const handler = createMonitorHandler(state.command);
    await handler(previousResolution);
    const previous = state.screens[2];
    const original = state.command.getMockImplementation()!;
    let fail = true;
    state.command.mockImplementation(async (args) => {
      if (fail && args.includes("--mirror=on") && !args.includes(`--tagID=${previous.tagID}`)) {
        fail = false;
        throw new Error("Mirroring unavailable");
      }
      return original(args);
    });
    await expect(handler("2000x200")).rejects.toThrow("Mirroring unavailable");
    expect(state.resolution()).toBe(previousResolution);
    expect(state.screens).toHaveLength(3);
    expect(state.screens[2]).toBe(previous);
    await handler("1920x1200");
    expect(state.resolution()).toBe("1920x1200");
  },
);

test("service failures are not interpreted as a missing virtual screen", async () => {
  const state = betterDisplay();
  state.command.mockRejectedValueOnce(new Error("CLI timed out"));
  await expect(createMonitorHandler(state.command)("1440x1728")).rejects.toThrow("CLI timed out");
  expect(state.command).toHaveBeenCalledTimes(1);
  expect(state.screens).toHaveLength(2);
});

test("missing Pro support reports the requirement before creating a custom screen", async () => {
  const state = betterDisplay();
  const original = state.command.getMockImplementation()!;
  state.command.mockImplementation((args) =>
    args.includes("--proAvailable") ? Promise.resolve("off") : original(args),
  );
  await expect(createMonitorHandler(state.command)("1440x1728")).rejects.toThrow(
    "BetterDisplay Pro",
  );
  expect(state.resolution()).toBe("1728x1117");
  expect(state.command.mock.calls.some(([args]) => args[0] === "create")).toBe(false);
});

test("a rejected create does not turn an absent screen into a rollback failure", async () => {
  const state = betterDisplay();
  const original = state.command.getMockImplementation()!;
  state.command.mockImplementation((args) =>
    args[0] === "create" ? Promise.reject(new Error("Cannot create screen")) : original(args),
  );
  await expect(createMonitorHandler(state.command)("1440x1728")).rejects.toThrow(
    /^Cannot create screen$/,
  );
  expect(state.resolution()).toBe("1728x1117");
  expect(state.screens).toHaveLength(2);
});

test("a successful CLI exit without the requested dimensions still rejects", async () => {
  useFakeTimers();
  // AbortSignal.timeout uses native timers, which the fake timers do not replace.
  const timeout = spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), milliseconds);
    return controller.signal;
  });
  try {
    const state = betterDisplay();
    const original = state.command.getMockImplementation()!;
    state.command.mockImplementation((args) =>
      args[0] === "set" && args.includes("--resolution=1920x1200")
        ? Promise.resolve("")
        : original(args),
    );
    // Bun's `expect(promise).rejects` blocks until the promise settles; capture the error instead.
    const result = createMonitorHandler(state.command)("1920x1200").then(
      () => undefined,
      (error: unknown) => error,
    );
    await runAllTimersAsync();
    expect(await result).toHaveProperty(
      "message",
      "BetterDisplay did not apply 1920x1200 (reported 1728x1117)",
    );
    expect(state.resolution()).toBe("1728x1117");
  } finally {
    timeout.mockRestore();
    useRealTimers();
  }
});

test("resolution polling retries missing and conflicting values before accepting repeated dimensions", async () => {
  useFakeTimers();
  try {
    const state = betterDisplay();
    const original = state.command.getMockImplementation()!;
    let attempts = 0;
    state.command.mockImplementation((args) => {
      if (
        args[0] === "get" &&
        args.includes("--type=Display") &&
        args.includes("--resolution") &&
        state.resolution() === "1920x1200"
      ) {
        attempts++;
        if (attempts === 1) return Promise.reject(missing());
        return Promise.resolve(attempts === 2 ? "1920x1200,1728x1117" : "1920x1200,1920x1200");
      }
      return original(args);
    });
    const result = createMonitorHandler(state.command)("1920x1200");
    await advanceTimersByTimeAsync(0);
    expect(attempts).toBe(1);
    await advanceTimersByTimeAsync(100);
    expect(attempts).toBe(2);
    await advanceTimersByTimeAsync(100);
    await result;
    expect(attempts).toBe(3);
    expect(state.resolution()).toBe("1920x1200");
  } finally {
    useRealTimers();
  }
});

test("a service error during resolution polling propagates and restores the native mode", async () => {
  const state = betterDisplay();
  const original = state.command.getMockImplementation()!;
  const failure = new Error("CLI connection lost");
  let failed = false;
  state.command.mockImplementation((args) => {
    if (
      !failed &&
      args[0] === "get" &&
      args.includes("--resolution") &&
      state.resolution() === "1920x1200"
    ) {
      failed = true;
      return Promise.reject(failure);
    }
    return original(args);
  });
  await expect(createMonitorHandler(state.command)("1920x1200")).rejects.toBe(failure);
  expect(state.resolution()).toBe("1728x1117");
});

test("a screen belonging to another application is never reconfigured", async () => {
  const command = mock()
    .mockRejectedValueOnce(missing())
    .mockResolvedValueOnce("My screen,My screen");
  await expect(createMonitorHandler(command)("1440x1728")).rejects.toThrow("Move the pointer");
  expect(command.mock.calls.every(([args]) => args[0] === "get")).toBe(true);
});

test("queued switches resolve the pointer after the previous change finishes", async () => {
  const state = betterDisplay();
  const original = state.command.getMockImplementation()!;
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  state.command.mockImplementationOnce(async (args) => {
    await gate;
    return original(args);
  });
  const handler = createMonitorHandler(state.command);
  const first = handler("1440x1728");
  const second = handler("1920x1200");
  await waitFor(() => expect(state.command).toHaveBeenCalledTimes(1));
  finish();
  await Promise.all([first, second]);
  expect(state.resolution()).toBe("1920x1200");
});

test("Bun CLI execution preserves arguments and reports process failures and timeouts", () => {
  const directory = mkdtempSync(join(tmpdir(), "chord-betterdisplay-"));
  try {
    const binary = join(directory, "fake-cli");
    writeFileSync(
      binary,
      '#!/usr/bin/env bun\nconst args = process.argv.slice(2); if (args[0] === "fail") { console.error("Failed."); process.exit(1); } if (args[0] === "wait") await new Promise(r => setTimeout(r, 5000)); console.log(JSON.stringify(args));\n',
      { mode: 0o755 },
    );
    const module = new URL("../src/js/monitor.ts", import.meta.url).href;
    const output = execFileSync(
      "bun",
      [
        "-e",
        `
      const { createBetterDisplayCommand } = await import(${JSON.stringify(module)});
      const command = createBetterDisplayCommand(process.argv[1], 500);
      const literal = await command(["get", "--name=a b;$(touch /tmp/chord-should-not-exist)"]);
      let failed, timedOut;
      try { await command(["fail"]); } catch (e) { failed = e.missing && e.message.includes("Failed."); }
      try { await command(["wait"]); } catch (e) { timedOut = e.message.includes("timeout 500ms"); }
      console.log(JSON.stringify({ literal: JSON.parse(literal), failed, timedOut }));
    `,
        binary,
      ],
      { encoding: "utf8", timeout: 10_000 },
    );
    expect(JSON.parse(output)).toEqual({
      literal: ["get", "--name=a b;$(touch /tmp/chord-should-not-exist)"],
      failed: true,
      timedOut: true,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
