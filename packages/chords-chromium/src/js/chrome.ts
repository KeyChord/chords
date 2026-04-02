import spawn from "nano-spawn-compat";
import { join } from "desm";
import { onAppLaunch, onAppTerminate, setAppNeedsRelaunch } from "chord";
import getPort from "get-port";

export default async function createChromiumHandler(this: ImportMeta, appPath: string) {
  let isPendingRestart = false;
  let remoteDebuggingPort: number | null = null;

  if (this.enableDebuggingPort) {
    // TODO: check
    setAppNeedsRelaunch(this.bundleId, true);

    const hasRemoteDebuggingPort = async (pid: number) => {
      const { stdout } = await spawn("ps", ["-p", pid.toString(), "-o", "command="]);
      return stdout.includes("remote-debugging-port");
    };

    // Ensures the app is launched with remote debugging
    onAppLaunch(this.bundleId, async (app) => {
      if (!(await hasRemoteDebuggingPort(app.pid))) {
        isPendingRestart = true;
        await spawn("kill", ["-15", app.pid.toString()]);
      }
    });

    onAppTerminate(this.bundleId, async () => {
      if (isPendingRestart) {
        isPendingRestart = false;
        remoteDebuggingPort = await getPort();
        await spawn("open", [
          "-na",
          appPath,
          "--args",
          `--remote-debugging-port=${remoteDebuggingPort}`,
        ]);
      }
    });
  }

  const chromeRemoteInterfaceBinPath = join(import.meta.url, "../bin/chrome-remote-interface");

  async function handlerJs(code: string) {
    if (!remoteDebuggingPort) {
      return false;
    }

    await spawn(chromeRemoteInterfaceBinPath, [remoteDebuggingPort.toString()], {
      stdin: { string: code },
    });
  }

  return async function handler(action: "js", code: string) {
    if (action === "js") {
      return handlerJs(code);
    }

    return false;
  };
}
