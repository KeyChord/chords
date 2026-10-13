import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { requireMacOSVM } from "./runtime";
import { buildNativeAddon, hostTriple } from "./native";

export async function runCommand(
  args: string[],
  options: {
    env?: Record<string, string | undefined>;
    timeout?: number;
    cwd?: string;
  } = {},
) {
  const child = Bun.spawn(args, {
    ...options,
    stdout: "pipe",
    stderr: "pipe",
    timeout: options.timeout ?? 30_000,
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`${args[0]} exited with ${code}\n${stderr}\n${stdout}`);
  return { stdout, stderr };
}

/** Poll observable fixture state, with a deadline instead of arbitrary UI sleeps. */
export async function waitFor<T>(read: () => Promise<T | undefined>, timeout = 5_000): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await read();
    if (result !== undefined) return result;
    await Bun.sleep(20);
  }
  throw new Error(`Fixture did not reach the expected state within ${timeout} ms`);
}

/** Always use the real Chord host; no mocked builtin exports in VM integration tests. */
export function runChordScript(
  script: URL | string,
  args: string[] = [],
  env: Record<string, string> = {},
) {
  requireMacOSVM();
  const host = process.env.CHORD_NATIVE_TEST_HOST;
  if (!host) throw new Error("CHORD_NATIVE_TEST_HOST is required; run vp run test:macos");
  return runCommand(
    [host, "bun", script instanceof URL ? Bun.fileURLToPath(script) : script, ...args],
    {
      env: { ...process.env, ...env },
      timeout: 60_000,
    },
  );
}

export type NativeTestTarget = { product: string; name: string };

export async function nativeTestTargets(root: string): Promise<NativeTestTarget[]> {
  const file = Bun.file(join(root, "Package.swift"));
  if (!(await file.exists())) return [];
  return [
    ...(await file.text()).matchAll(/\.library\(name:\s*"([^"]+)"[^\n]*type:\s*\.dynamic/g),
  ].map((match) => {
    const suffix = match[1].split("Native")[1];
    if (!suffix) throw new Error(`Cannot infer native output name for ${match[1]}`);
    return { product: match[1], name: suffix[0].toLowerCase() + suffix.slice(1) };
  });
}

export async function prepareMacOSPackage(root: string, native?: NativeTestTarget[]) {
  for (const target of native ?? (await nativeTestTargets(root))) {
    await buildNativeAddon({
      packageRoot: root,
      ...target,
      mode: "debug",
      outputDirectory: join(root, "target", hostTriple, target.name),
    });
  }
}

/** Validate the package's shipped definitions and load its production JS in the guest. */
export async function testMacOSPackage(testURL: string, native?: NativeTestTarget[]) {
  requireMacOSVM();
  const root = dirname(dirname(Bun.fileURLToPath(testURL)));
  await prepareMacOSPackage(root, native);
  const { stdout } = await runChordScript(new URL("./verify-package.ts", import.meta.url), [root]);
  if (!stdout.includes("package-macos-ok"))
    throw new Error(`Package smoke test did not finish: ${stdout}`);
}

export type MacOSFixture = {
  bundleId: string;
  output: string;
  directory: string;
  close(): Promise<void>;
};

/** Compile and launch a controlled AppKit app, confined to virtual macOS hardware. */
export async function launchMacOSFixture(source: URL, bundleId: string): Promise<MacOSFixture> {
  requireMacOSVM();
  if (!/^[a-zA-Z0-9.-]+$/.test(bundleId)) throw new Error("Invalid fixture bundle ID");
  const directory = await mkdtemp(join(tmpdir(), "chordtest-fixture-"));
  const name = basename(Bun.fileURLToPath(source), ".swift");
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("Invalid fixture app name");
  const app = join(directory, `${name}.app`);
  const contents = join(app, "Contents");
  const binary = join(contents, "MacOS", name);
  const output = join(directory, "events.json");
  let child: ReturnType<typeof Bun.spawn> | undefined;
  const fixture: MacOSFixture = {
    bundleId,
    output,
    directory,
    async close() {
      const pidFile = Bun.file(`${output}.pid`);
      if (await pidFile.exists()) {
        const pid = Number(await pidFile.text());
        if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Invalid fixture process ID");
        try {
          process.kill(pid, "SIGTERM");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      }
      if (child) {
        await Promise.race([child.exited, Bun.sleep(5_000)]);
        if (child.exitCode === null) {
          child.kill();
          await child.exited;
        }
      }
      if (process.env.CHORD_TESTING_ARTIFACTS && (await Bun.file(output).exists())) {
        await Bun.write(
          join(process.env.CHORD_TESTING_ARTIFACTS, `${bundleId}.json`),
          Bun.file(output),
        );
      }
      await rm(directory, { recursive: true, force: true });
    },
  };
  try {
    await mkdir(dirname(binary), { recursive: true });
    await Bun.write(
      join(contents, "Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${bundleId}</string>
<key>CFBundleName</key><string>${name}</string>
<key>CFBundleExecutable</key><string>${name}</string>
<key>CFBundlePackageType</key><string>APPL</string></dict></plist>`,
    );
    await runCommand(
      ["/usr/bin/swiftc", "-parse-as-library", Bun.fileURLToPath(source), "-o", binary],
      { timeout: 60_000 },
    );
    await runCommand(["/usr/bin/codesign", "--force", "--sign", "-", app]);
    child = Bun.spawn(
      [
        "/usr/bin/open",
        "-W",
        "-n",
        "--env",
        `CHORD_FIXTURE_OUTPUT=${output}`,
        "--env",
        `MENU_FIXTURE_OUTPUT=${output}`,
        app,
      ],
      { stdout: "inherit", stderr: "inherit" },
    );
    await waitFor(async () => {
      if (child!.exitCode !== null) throw new Error("Fixture exited before becoming ready");
      return (await Bun.file(`${output}.pid`).exists()) ? true : undefined;
    }, 10_000);
    return fixture;
  } catch (error) {
    await fixture.close();
    throw error;
  }
}
