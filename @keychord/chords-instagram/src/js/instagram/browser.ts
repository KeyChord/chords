import { onAppLaunch, onAppTerminate, setAppNeedsRelaunch } from "chord";

const braveBundleId = "com.brave.Browser";
type ObservedApp = { pid: number; bundleId: string };

async function run(command: string[], allowedExitCodes = [0]): Promise<string> {
  const child = Bun.spawn(command, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 5000,
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (!allowedExitCodes.includes(exitCode)) {
    throw new Error(stderr.trim() || `${command[0]} failed (exit ${exitCode}).`);
  }
  return stdout;
}

/** The installed Instagram app is a shim; its browser owns the debugging endpoint. */
export function configureBraveDebugging(port: number): Promise<void> {
  let pendingRestartPid: number | null = null;
  let restartDeadline = 0;
  let checks: Promise<void> = Promise.resolve();

  const check = (app: ObservedApp) => {
    const pending = checks.then(async () => {
      if (pendingRestartPid !== null && Date.now() <= restartDeadline) return;
      pendingRestartPid = null;
      const command = await run(["/bin/ps", "-p", String(app.pid), "-o", "command="], [0, 1]);
      // The app can exit between its launch notification and this check.
      if (!command.trim()) return;
      const debuggingPort = /(?:^|\s)--remote-debugging-port(?:=|\s+)(\d+)(?=\s|$)/.exec(command);
      const needsRelaunch = Number(debuggingPort?.[1]) !== port;
      setAppNeedsRelaunch(braveBundleId, needsRelaunch);
      if (!needsRelaunch) return;
      if (command.includes("--user-data-dir")) {
        throw new Error(
          "Start Brave's custom user-data directory with the Instagram debugging port manually.",
        );
      }

      // Set this before signaling: the termination event can arrive immediately.
      pendingRestartPid = app.pid;
      restartDeadline = Date.now() + 10_000;
      try {
        await run(["/bin/kill", "-TERM", String(app.pid)]);
      } catch (error) {
        pendingRestartPid = null;
        throw error;
      }
    });
    checks = pending.catch(() => undefined);
    return pending;
  };

  onAppTerminate(braveBundleId, async (app: ObservedApp) => {
    setAppNeedsRelaunch(braveBundleId, true);
    if (app.pid !== pendingRestartPid) return;
    // A normal quit must stay quit, and duplicate events must not open more instances.
    pendingRestartPid = null;
    // A refused or stalled graceful quit must not turn a later user quit into a restart.
    if (Date.now() > restartDeadline) return;
    await run([
      "/usr/bin/open",
      "-n",
      "-b",
      braveBundleId,
      "--args",
      `--remote-debugging-port=${port}`,
      "--restore-last-session",
    ]);
  });
  onAppLaunch(braveBundleId, check);

  return (async () => {
    const pids = (await run(["/usr/bin/pgrep", "-x", "Brave Browser"], [0, 1]))
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
    if (!pids.length) {
      setAppNeedsRelaunch(braveBundleId, true);
      return;
    }
    // Avoid terminating multiple Brave instances and reopening the wrong profile.
    if (pids.length !== 1 || !Number.isSafeInteger(pids[0]) || pids[0] <= 0) {
      setAppNeedsRelaunch(braveBundleId, true);
      throw new Error("Close extra Brave Browser instances before enabling Instagram debugging.");
    }
    await check({ pid: pids[0], bundleId: braveBundleId });
  })();
}
