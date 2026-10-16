import { onAppLaunch, onAppTerminate, setAppNeedsRelaunch } from "chord";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import {
  advanceTimersByTimeAsync,
  mocked,
  useFakeTimers,
  useRealTimers,
} from "@keychord/chordtest/test";
import { configureBraveDebugging } from "../src/js/instagram/browser";

mock.module("chord", () => ({
  onAppLaunch: mock(),
  onAppTerminate: mock(),
  setAppNeedsRelaunch: mock(),
}));

const bundleId = "com.brave.Browser";
const app = (pid = 123) => ({ pid, bundleId });
let runningPids: string;
let commandLine: string;
let failure: string | undefined;
const spawn = mock((command: string[]) => {
  let stdout = "";
  let exitCode = 0;
  let stderr = "";
  if (command[0] === "/usr/bin/pgrep") {
    stdout = runningPids;
    exitCode = stdout ? 0 : 1;
  } else if (command[0] === "/bin/ps") {
    stdout = commandLine;
    exitCode = stdout ? 0 : 1;
  }
  if (command[0] === failure) {
    exitCode = 2;
    stderr = "Permission denied";
  }
  return {
    exited: Promise.resolve(exitCode),
    stdout: new Response(stdout).body,
    stderr: new Response(stderr).body,
  };
});
const launch = () =>
  mocked(onAppLaunch).mock.calls[0][1] as (value: ReturnType<typeof app>) => Promise<void>;
const terminate = () =>
  mocked(onAppTerminate).mock.calls[0][1] as (value: ReturnType<typeof app>) => Promise<void>;
const commands = () => spawn.mock.calls.map(([command]) => command);
const signals = () => commands().filter(([program]) => program === "/bin/kill");
const opens = () => commands().filter(([program]) => program === "/usr/bin/open");

beforeEach(() => {
  mock.clearAllMocks();
  spyOn(Bun, "spawn").mockImplementation(spawn as unknown as typeof Bun.spawn);
  runningPids = "";
  commandLine = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
  failure = undefined;
});
afterEach(() => {
  mock.restore();
  useRealTimers();
});

test("watches Brave rather than the Instagram shim and leaves a closed browser closed", async () => {
  await configureBraveDebugging(9222);
  expect(onAppLaunch).toHaveBeenCalledTimes(1);
  expect(onAppLaunch).toHaveBeenCalledWith(bundleId, expect.any(Function));
  expect(onAppTerminate).toHaveBeenCalledTimes(1);
  expect(onAppTerminate).toHaveBeenCalledWith(bundleId, expect.any(Function));
  expect(setAppNeedsRelaunch).toHaveBeenLastCalledWith(bundleId, true);
  expect(signals()).toEqual([]);
  await terminate()(app());
  expect(opens()).toEqual([]);
});

test("a running browser is gracefully relaunched once after its matching termination", async () => {
  runningPids = "123\n";
  await configureBraveDebugging(9222);
  expect(signals()).toEqual([["/bin/kill", "-TERM", "123"]]);
  expect(opens()).toEqual([]);
  await launch()(app());
  await terminate()(app(456));
  expect(signals()).toHaveLength(1);
  expect(opens()).toEqual([]);
  await terminate()(app());
  await terminate()(app());
  expect(opens()).toEqual([
    [
      "/usr/bin/open",
      "-n",
      "-b",
      bundleId,
      "--args",
      "--remote-debugging-port=9222",
      "--restore-last-session",
    ],
  ]);
  commandLine += " --remote-debugging-port=9222";
  await launch()(app(789));
  expect(setAppNeedsRelaunch).toHaveBeenLastCalledWith(bundleId, false);
  expect(signals()).toHaveLength(1);
  await terminate()(app(789));
  expect(opens()).toHaveLength(1);
});

test.each(["--remote-debugging-port=9333", "--remote-debugging-port 9333"])(
  "a matching custom port needs no relaunch: %s",
  async (flag) => {
    runningPids = "123";
    commandLine += ` ${flag}`;
    await configureBraveDebugging(9333);
    expect(setAppNeedsRelaunch).toHaveBeenLastCalledWith(bundleId, false);
    expect(signals()).toEqual([]);
  },
);

test.each([
  "--remote-debugging-port=92220",
  "--remote-debugging-port=9333",
  "--other-remote-debugging-port=9222",
])("a new launch with a missing or different port is relaunched: %s", async (flag) => {
  await configureBraveDebugging(9222);
  commandLine += ` ${flag}`;
  await launch()(app());
  expect(setAppNeedsRelaunch).toHaveBeenLastCalledWith(bundleId, true);
  await terminate()(app());
  expect(opens()[0]).toContain("--remote-debugging-port=9222");
});

test("automatic relaunch uses the configured custom port", async () => {
  await configureBraveDebugging(9333);
  await launch()(app());
  await terminate()(app());
  expect(opens()[0]).toContain("--remote-debugging-port=9333");
});

test("a failed termination reports the error and does not reopen on a later normal quit", async () => {
  await configureBraveDebugging(9222);
  failure = "/bin/kill";
  await expect(launch()(app())).rejects.toThrow("Permission denied");
  await terminate()(app());
  expect(opens()).toEqual([]);
  failure = undefined;
  await launch()(app(456));
  await terminate()(app(456));
  expect(opens()).toHaveLength(1);
});

test("a refused graceful quit does not reopen a browser quit later by the user", async () => {
  useFakeTimers();
  await configureBraveDebugging(9222);
  await launch()(app());
  await advanceTimersByTimeAsync(10_001);
  await terminate()(app());
  expect(opens()).toEqual([]);
  expect(setAppNeedsRelaunch).toHaveBeenLastCalledWith(bundleId, true);
});

test("a failed reopen keeps the relaunch flag and does not loop on duplicate events", async () => {
  await configureBraveDebugging(9222);
  await launch()(app());
  failure = "/usr/bin/open";
  await expect(terminate()(app())).rejects.toThrow("Permission denied");
  await terminate()(app());
  expect(opens()).toHaveLength(1);
  expect(setAppNeedsRelaunch).toHaveBeenLastCalledWith(bundleId, true);
});

test("an app that has already exited is not signaled", async () => {
  await configureBraveDebugging(9222);
  commandLine = "";
  await launch()(app());
  expect(signals()).toEqual([]);
});

test("process discovery failures propagate and subprocesses have bounded timeouts", async () => {
  failure = "/usr/bin/pgrep";
  await expect(configureBraveDebugging(9222)).rejects.toThrow("Permission denied");
  expect(spawn).toHaveBeenCalledWith(["/usr/bin/pgrep", "-x", "Brave Browser"], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 5000,
  });
  expect(signals()).toEqual([]);
});

test("extra Brave instances are not terminated", async () => {
  runningPids = "123\n456\n";
  await expect(configureBraveDebugging(9222)).rejects.toThrow("extra Brave Browser instances");
  expect(signals()).toEqual([]);
});

test("a custom user-data directory is not replaced with the default profile", async () => {
  runningPids = "123";
  commandLine += " --user-data-dir=/tmp/brave-test";
  await expect(configureBraveDebugging(9222)).rejects.toThrow("custom user-data directory");
  expect(signals()).toEqual([]);
});
