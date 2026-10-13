import { mkdir, mkdtemp, rm, statfs, writeFile } from "node:fs/promises";
import { closeSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { prepareChordHost } from "./host";

export type VMOptions = {
  name: string;
  image: string;
  workspace: string;
  tartHome: string;
  tart: string;
  runtime: string;
  results: string;
};
export const workspaceRoot = Bun.fileURLToPath(new URL("../../..", import.meta.url));
const stateDirectory = join(workspaceRoot, ".chord-testing");
const localTools = join(homedir(), ".local", "share", "chords-testing");
const localTart = join(localTools, "tart.app", "Contents", "MacOS", "tart");
const tartVersion = "2.40.1";
const tartArchiveSHA256 = "363e2701154a8155cbc1bb6d845430c9b42697d2a186bc49574471ca2877db46";
export const defaultVMImage =
  "ghcr.io/cirruslabs/macos-tahoe-base@sha256:87f3aa5ce21b5c876268f233bdfecf38b4c2a8116fe9bbb718e714cbae187377";

export function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function vmOptions(env = process.env): VMOptions {
  const options = {
    name: env.CHORD_TESTING_VM_NAME ?? "chords-testing-tahoe-87f3aa5c",
    image: env.CHORD_TESTING_VM_IMAGE ?? defaultVMImage,
    workspace: workspaceRoot,
    tartHome: env.TART_HOME ?? join(homedir(), ".tart"),
    tart: env.CHORD_TESTING_TART ?? Bun.which("tart") ?? localTart,
    runtime: join(stateDirectory, "runtime"),
    results: join(stateDirectory, "results"),
  };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(options.name))
    throw new Error("Invalid CHORD_TESTING_VM_NAME");
  return options;
}

export function vmRunArguments(options: VMOptions) {
  const config = join(options.workspace, "..", "config");
  if (
    [options.workspace, config, options.runtime, options.results].some((path) => path.includes(":"))
  )
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
    `--dir=chords-config:${config}:ro`,
    `--dir=chords-runtime:${options.runtime}:ro`,
    `--dir=chords-results:${options.results}`,
  ];
}

export function discoverMacOSTests(paths: string[] = [], workspace = workspaceRoot): string[] {
  if (paths.some((path) => path.startsWith("/") || path.split("/").includes(".."))) {
    throw new Error("Test paths must be relative to the workspace");
  }
  const all = [
    ...new Bun.Glob("@keychord/*/__tests__/*.vm.test.ts").scanSync({ cwd: workspace }),
  ].sort();
  if (!paths.length) {
    const missing = [...new Bun.Glob("@keychord/*/package.json").scanSync({ cwd: workspace })]
      .map((manifest) => `${manifest.slice(0, -13)}/__tests__/macos.vm.test.ts`)
      .filter((test) => !all.includes(test));
    if (missing.length)
      throw new Error(`Missing macOS VM test entry points: ${missing.join(", ")}`);
  }
  const tests = paths.length
    ? all.filter((test) =>
        paths.some((path) => test === path || test.startsWith(`${path.replace(/\/$/, "")}/`)),
      )
    : all;
  if (!tests.length) throw new Error("No macOS VM tests found for the requested paths");
  return tests;
}

export function guestTestScript(paths: string[]) {
  // Validate selectors before constructing shell code. Only discovered VM tests are executed.
  const tests = discoverMacOSTests(paths);
  return `set -euo pipefail
export PATH="$HOME/.bun/bin:$HOME/.vite-plus/bin:$HOME/.vite-plus/0.1.15/bin:$HOME/.vite-plus/0.1.15:/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
/bin/bash '/Volumes/My Shared Files/chords-sources/@keychord/chordtest/src/guest-workspace.sh'
mkdir -p "$HOME/.local/share/chordtest/runtime"
rsync -a --delete '/Volumes/My Shared Files/chords-runtime/' "$HOME/.local/share/chordtest/runtime/"
export CHORD_NATIVE_TEST_HOST="$HOME/.local/share/chordtest/runtime/MacOS/chord"
export DYLD_LIBRARY_PATH="$HOME/.local/share/chordtest/runtime/Frameworks"
cd "$HOME/chords-workspace"
CHORD_SKIP_NATIVE=1 vp run build
export CHORD_TESTING_UI=1
export CHORD_TESTING_ARTIFACTS='/Volumes/My Shared Files/chords-results'
bun test --timeout 300000 ${tests.map((path) => shellQuote(`./${path}`)).join(" ")} 2>&1 | tee '/Volumes/My Shared Files/chords-results/tests.log'
`;
}

async function command(
  args: string[],
  options: { capture?: boolean; timeout?: number; env?: Record<string, string | undefined> } = {},
) {
  const child = Bun.spawn(args, {
    stdout: options.capture ? "pipe" : "inherit",
    stderr: options.capture ? "pipe" : "inherit",
    env: options.env,
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

  private command(args: string[], options: { capture?: boolean; timeout?: number } = {}) {
    return command([this.options.tart, ...args], {
      ...options,
      env: { ...process.env, TART_HOME: this.options.tartHome, TART_NO_AUTO_PRUNE: "1" },
    });
  }

  async status(name = this.options.name) {
    const machines = JSON.parse(
      await this.command(["list", "--source", "local", "--format", "json"], {
        capture: true,
      }),
    ) as { Name: string; Running: boolean; State: string }[];
    return machines.find((machine) => machine.Name === name);
  }

  async setup() {
    if (process.platform !== "darwin" || process.arch !== "arm64")
      throw new Error("Tart requires an Apple Silicon Mac");
    await prepareChordHost(this.options.workspace, this.options.runtime);
    await mkdir(this.options.results, { recursive: true });
    if (!Bun.which(this.options.tart)) {
      if (this.options.tart !== localTart)
        throw new Error(`Tart executable not found: ${this.options.tart}`);
      await mkdir(localTools, { recursive: true });
      const archive = join(localTools, "tart.tar.gz");
      await command([
        "/usr/bin/curl",
        "-fL",
        `https://github.com/openai/tart/releases/download/${tartVersion}/tart.tar.gz`,
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
      await this.command(["clone", this.options.image, this.options.name]);
      await this.command([
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
      await this.command([
        "exec",
        this.options.name,
        "/bin/bash",
        "/Volumes/My Shared Files/chords-sources/@keychord/chordtest/src/guest-setup.sh",
      ]);
    });
  }

  async inGuest<T>(
    operation: () => Promise<T>,
    name = this.options.name,
    workspace = this.options.workspace,
  ): Promise<T> {
    if ((await this.status(name))?.Running)
      throw new Error(`VM ${name} is already running. Stop it before mounting the workspace.`);
    await mkdir(stateDirectory, { recursive: true });
    const logPath = join(stateDirectory, "vm.log");
    const log = openSync(logPath, "a");
    const child = Bun.spawn(vmRunArguments({ ...this.options, name, workspace }), {
      stdout: log,
      stderr: log,
      env: { ...process.env, TART_HOME: this.options.tartHome, TART_NO_AUTO_PRUNE: "1" },
    });
    closeSync(log);
    const deadline = Date.now() + 180_000;
    try {
      let ready = false;
      while (!ready && Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`VM exited before booting. See ${logPath}`);
        try {
          await this.command(["exec", name, "/usr/bin/true"], {
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
        await this.stop(name);
        await child.exited;
      }
    }
  }

  async test(paths: string[]) {
    const script = guestTestScript(paths);
    if (!(await this.status()))
      throw new Error("The test VM is not prepared. Run vp run test:macos:setup first.");
    if ((await this.status())?.Running)
      throw new Error("Stop the prepared VM before cloning it for tests");
    await prepareChordHost(this.options.workspace, this.options.runtime);
    await mkdir(this.options.results, { recursive: true });
    const name = `${this.options.name}-run-${process.pid}`;
    if (await this.status(name))
      throw new Error(`Test clone ${name} already exists; refusing to replace it`);
    const snapshot = await mkdtemp(join(stateDirectory, "source-"));
    try {
      // Freeze both linked checkouts before booting; later host edits cannot
      // change the suite's inputs, including its shared config.
      for (const [source, destination] of [
        [this.options.workspace, join(snapshot, "chords")],
        [join(this.options.workspace, "..", "config"), join(snapshot, "config")],
      ]) {
        await mkdir(destination, { recursive: true });
        await command([
          "/usr/bin/rsync",
          "-a",
          "--exclude=node_modules",
          "--exclude=.git",
          "--exclude=.jj",
          "--exclude=.build",
          "--exclude=.chord-testing",
          "--exclude=target",
          `${source.replace(/\/$/, "")}/`,
          `${destination}/`,
        ]);
      }
      await this.command(["clone", this.options.name, name]);
      try {
        await this.inGuest(
          () => this.command(["exec", name, "/bin/bash", "-c", script]),
          name,
          join(snapshot, "chords"),
        );
      } finally {
        await this.command(["delete", name]);
      }
    } finally {
      await rm(snapshot, { recursive: true, force: true });
    }
  }

  async stop(name = this.options.name) {
    await this.command(["stop", name], { timeout: 30_000 });
  }
}
