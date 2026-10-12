import { mkdir, rm, statfs, writeFile } from "node:fs/promises";
import { closeSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type VMOptions = {
  name: string;
  image: string;
  workspace: string;
  tartHome: string;
  tart: string;
};
export const workspaceRoot = Bun.fileURLToPath(new URL("../../..", import.meta.url));
const stateDirectory = join(workspaceRoot, ".chord-testing");
const localTools = join(homedir(), ".local", "share", "chords-testing");
const localTart = join(localTools, "tart.app", "Contents", "MacOS", "tart");
const tartVersion = "2.40.1";
const tartArchiveSHA256 = "363e2701154a8155cbc1bb6d845430c9b42697d2a186bc49574471ca2877db46";

export function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function vmOptions(env = process.env): VMOptions {
  const options = {
    name: env.CHORD_TESTING_VM_NAME ?? "chords-testing-tahoe",
    image: env.CHORD_TESTING_VM_IMAGE ?? "ghcr.io/cirruslabs/macos-tahoe-base:latest",
    workspace: workspaceRoot,
    tartHome: env.TART_HOME ?? join(homedir(), ".tart"),
    tart: env.CHORD_TESTING_TART ?? Bun.which("tart") ?? localTart,
  };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(options.name))
    throw new Error("Invalid CHORD_TESTING_VM_NAME");
  return options;
}

export function vmRunArguments(options: VMOptions) {
  if (options.workspace.includes(":"))
    throw new Error("Tart shared-directory paths cannot contain colons");
  return [
    options.tart,
    "run",
    options.name,
    "--no-graphics",
    "--no-audio",
    "--no-clipboard",
    "--no-usb-accessories",
    `--dir=chords-sources:${options.workspace}:ro`,
  ];
}

export function guestTestScript(paths: string[]) {
  if (paths.some((path) => path.startsWith("/") || path.split("/").includes(".."))) {
    throw new Error("Test paths must be relative to the workspace");
  }
  const tests = paths.length
    ? paths
    : ["@keychord/chordtest/__tests__", "@keychord/chords-tray/__tests__"];
  return `set -euo pipefail
export PATH="$HOME/.bun/bin:$HOME/.vite-plus/bin:$HOME/.vite-plus/0.1.15/bin:$HOME/.vite-plus/0.1.15:/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
mkdir -p "$HOME/chords-workspace"
rsync -a --delete --exclude=node_modules --exclude=.git --exclude=.build --exclude=.chord-testing --exclude=target '/Volumes/My Shared Files/chords-sources/' "$HOME/chords-workspace/"
cd "$HOME/chords-workspace"
vp install --frozen-lockfile
CHORD_TESTING_UI=1 bun test ${tests.map(shellQuote).join(" ")}
`;
}

async function command(args: string[], options: { capture?: boolean; timeout?: number } = {}) {
  const child = Bun.spawn(args, {
    stdout: options.capture ? "pipe" : "inherit",
    stderr: options.capture ? "pipe" : "inherit",
  });
  const timeout = options.timeout ? setTimeout(() => child.kill(), options.timeout) : undefined;
  try {
    const stdout = options.capture
      ? new Response(child.stdout as ReadableStream).text()
      : Promise.resolve("");
    const stderr = options.capture
      ? new Response(child.stderr as ReadableStream).text()
      : Promise.resolve("");
    const [output, errors, exitCode] = await Promise.all([stdout, stderr, child.exited]);
    if (exitCode !== 0)
      throw new Error(
        `${args[0]} ${args[1] ?? ""} exited with ${exitCode}${errors ? `: ${errors.trim()}` : ""}`,
      );
    return output;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function withVMLock<T>(operation: () => Promise<T>) {
  await mkdir(stateDirectory, { recursive: true });
  const lock = join(stateDirectory, "vm.lock");
  try {
    // Bun.write does not support exclusive creation; keep this lock atomic.
    await writeFile(lock, JSON.stringify({ pid: process.pid }), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const owner = (await Bun.file(lock).json()) as { pid: number };
    try {
      process.kill(owner.pid, 0);
    } catch (signalError) {
      if ((signalError as NodeJS.ErrnoException).code !== "ESRCH") throw signalError;
      await rm(lock);
      return withVMLock(operation);
    }
    throw new Error(`The shared test VM is already in use by process ${owner.pid}`);
  }
  try {
    return await operation();
  } finally {
    await rm(lock, { force: true });
  }
}

export class MacOSVM {
  constructor(readonly options = vmOptions()) {}

  async status() {
    const machines = JSON.parse(
      await command([this.options.tart, "list", "--source", "local", "--format", "json"], {
        capture: true,
      }),
    ) as { Name: string; Running: boolean; State: string }[];
    return machines.find((machine) => machine.Name === this.options.name);
  }

  async setup() {
    if (process.platform !== "darwin" || process.arch !== "arm64")
      throw new Error("Tart requires an Apple Silicon Mac");
    if (!Bun.which(this.options.tart)) {
      if (this.options.tart !== localTart)
        throw new Error(`Tart executable not found: ${this.options.tart}`);
      await mkdir(localTools, { recursive: true });
      const archive = join(localTools, "tart.tar.gz");
      await command([
        "/usr/bin/curl",
        "-fL",
        `https://github.com/cirruslabs/tart/releases/download/${tartVersion}/tart.tar.gz`,
        "-o",
        archive,
      ]);
      const digest = new Bun.CryptoHasher("sha256")
        .update(await Bun.file(archive).arrayBuffer())
        .digest("hex");
      if (digest !== tartArchiveSHA256) throw new Error("Tart release archive checksum mismatch");
      await command(["/usr/bin/tar", "-xzf", archive, "-C", localTools]);
      await rm(archive);
    }
    if (!(await this.status())) {
      await mkdir(this.options.tartHome, { recursive: true });
      const disk = await statfs(this.options.tartHome);
      const available = (disk.bavail * disk.bsize) / 1024 ** 3;
      if (available < 45)
        throw new Error(
          `Only ${available.toFixed(1)} GiB free for the macOS VM; need at least 45 GiB for the image and build output. Free rebuildable caches or set TART_HOME to another volume.`,
        );
      await command([this.options.tart, "clone", this.options.image, this.options.name]);
      await command([
        this.options.tart,
        "set",
        this.options.name,
        "--cpu",
        "4",
        "--memory",
        "8192",
        "--display",
        "1440x900",
      ]);
    }
    await this.inGuest(async () => {
      await command([
        this.options.tart,
        "exec",
        this.options.name,
        "/bin/bash",
        "/Volumes/My Shared Files/chords-sources/@keychord/chordtest/src/guest-setup.sh",
      ]);
    });
  }

  async inGuest<T>(operation: () => Promise<T>): Promise<T> {
    if ((await this.status())?.Running)
      throw new Error(
        `VM ${this.options.name} is already running. Stop it with vp run test:macos:stop before mounting the workspace.`,
      );
    await mkdir(stateDirectory, { recursive: true });
    const logPath = join(stateDirectory, "vm.log");
    const log = openSync(logPath, "a");
    const child = Bun.spawn(vmRunArguments(this.options), { stdout: log, stderr: log });
    closeSync(log);
    const deadline = Date.now() + 180_000;
    try {
      let ready = false;
      while (!ready && Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`VM exited before booting. See ${logPath}`);
        try {
          await command([this.options.tart, "exec", this.options.name, "/usr/bin/true"], {
            capture: true,
            timeout: 5_000,
          });
          ready = true;
        } catch {
          await Bun.sleep(1_000);
        }
      }
      if (!ready)
        throw new Error(`Guest agent did not become ready within 3 minutes. See ${logPath}`);
      return await operation();
    } finally {
      if (child.exitCode === null) {
        await this.stop();
        await child.exited;
      }
    }
  }

  async test(paths: string[]) {
    if (!(await this.status()))
      throw new Error("The test VM is not prepared. Run vp run test:macos:setup first.");
    await this.inGuest(() =>
      command([
        this.options.tart,
        "exec",
        this.options.name,
        "/bin/bash",
        "-c",
        guestTestScript(paths),
      ]),
    );
  }

  async stop() {
    await command([this.options.tart, "stop", this.options.name], { timeout: 30_000 });
  }
}
