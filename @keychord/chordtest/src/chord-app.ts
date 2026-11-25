import { mkdir, mkdtemp, readlink, realpath, rm, symlink } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { runCommand, waitFor } from "./macos";
import { requireMacOSVM } from "./runtime";
import { shellQuote } from "./vm";

const readySequence = ";zzchordtest";
const appPath = "/Applications/Chordtest.app";

export type ChordApp = {
  run(sequence: string): Promise<void>;
  runChecked(sequence: string): Promise<void>;
  flush(): Promise<void>;
  expectFailure(sequence: string, error: RegExp): Promise<void>;
};

/** Execute the checked-in package via the installed app's resolver and action runner. */
export async function withChordPackage<T>(
  testURL: string,
  body: (app: ChordApp) => Promise<T>,
): Promise<T> {
  requireMacOSVM();
  const source = process.env.CHORD_TESTING_APP;
  if (!source || !(await Bun.file(join(source, "Contents/Info.plist")).exists())) {
    throw new Error("A full Chord.app is required. Set CHORD_TESTING_APP on the Tart host.");
  }
  const { stdout: bundleId } = await runCommand([
    "/usr/libexec/PlistBuddy",
    "-c",
    "Print :CFBundleIdentifier",
    join(source, "Contents/Info.plist"),
  ]);
  const id = bundleId.trim();
  if (!/^[\w.-]+$/.test(id)) throw new Error(`Invalid Chord bundle ID: ${id}`);
  const executable = join(appPath, "Contents/MacOS/chord");
  const appData = join(homedir(), "Library/Application Support", id);
  const packages = join(homedir(), ".chord/packages");
  const root = dirname(dirname(Bun.fileURLToPath(testURL)));
  const packagePath = join(packages, `chordtest-fixture-${basename(root)}`);
  const probePath = join(packages, "chordtest-ready");
  const scratch = await mkdtemp(join(tmpdir(), "chordtest-app-"));
  const marker = join(scratch, "ready");
  const workerStderr = join(scratch, "worker.stderr");
  const log = join(homedir(), "Library/Logs", id, "chords.log");
  let launched = false;
  const added: string[] = [];
  const env = { ...process.env };
  delete env.DYLD_LIBRARY_PATH;
  const processPattern = `^${executable.replaceAll(".", "\\.")}( -psn_[^ ]+)?$`;
  const stop = async () => {
    if (Bun.spawnSync(["/usr/bin/pkill", "-TERM", "-f", processPattern]).exitCode === 0) {
      await waitFor(async () =>
        Bun.spawnSync(["/usr/bin/pgrep", "-f", processPattern]).exitCode === 1 ? true : undefined,
      );
    }
  };
  const app: ChordApp = {
    async run(sequence: string) {
      // The public CLI launches this process and exits. Wait for the actual IPC sender
      // so two rapid invocations cannot race one another to the app.
      await runCommand([executable, "__app-chord", sequence], { env, timeout: 30_000 });
    },
    async flush() {
      await rm(marker, { force: true });
      await app.run(readySequence);
      await waitFor(async () => ((await Bun.file(marker).exists()) ? true : undefined), 20_000);
    },
    async runChecked(sequence) {
      const deadline = Date.now() + 3_000;
      let output: string;
      do {
        const start = Bun.file(log).size;
        await app.run(sequence);
        await app.flush();
        output = await Bun.file(log).slice(start).text();
        if (
          !/error running chord events|Failed to handle command from another Chord instance/i.test(
            output,
          )
        )
          return;
        // Chord observes focus asynchronously. A no-match result has dispatched no action.
        if (!output.includes(`no chord is configured for \`${sequence}\``)) break;
        await Bun.sleep(150);
      } while (Date.now() < deadline);
      throw new Error(`Chord ${sequence} failed. ${output.trim()}`);
    },
    async expectFailure(sequence, error) {
      const start = Bun.file(log).size;
      await app.run(sequence);
      await waitFor(async () =>
        error.test(await Bun.file(log).slice(start).text()) ? true : undefined,
      );
    },
  };
  try {
    if (!(await Bun.file(join(appPath, "Contents/Info.plist")).exists())) {
      await runCommand(["/usr/bin/ditto", source, appPath]);
      await runCommand([
        "/bin/bash",
        "-e",
        "-c",
        `
# codesign prefixes the synthesized requirement of an ad-hoc fixture with "# ".
requirement=$(codesign -d -r- "$1" 2>&1 | sed -nE 's/^(# )?designated => //p')
if [ -z "$requirement" ]; then
  printf 'Could not read the designated code requirement for %s\\n' "$1" >&2
  exit 1
fi
blob=$(mktemp)
trap 'rm -f "$blob"' EXIT
printf '%s' "$requirement" | csreq -r- -b "$blob"
hex=$(xxd -p "$blob" | tr -d '\\n')
sudo sqlite3 "/Library/Application Support/com.apple.TCC/TCC.db" "
  INSERT OR REPLACE INTO access
    (service, client, client_type, auth_value, auth_reason, auth_version, csreq, flags, last_modified)
  VALUES ('kTCCServiceAccessibility', '$2', 0, 2, 4, 1, X'$hex', 0, strftime('%s','now'));"
sudo killall tccd
`,
        "chordtest-grant",
        appPath,
        id,
      ]);
    }
    await mkdir(appData, { recursive: true });
    await mkdir(packages, { recursive: true });
    // Bun can time out a scenario before its finally runs. Recover the prior test's own
    // app and symlinks so a fail in one package does not mask the others.
    await stop();
    await rm(probePath, { recursive: true, force: true });
    for await (const entry of new Bun.Glob("chordtest-fixture-*").scan({
      cwd: packages,
      onlyFiles: false,
    })) {
      const path = join(packages, entry);
      const target = await readlink(path).catch(() => "");
      if (dirname(target) === dirname(root)) await rm(path);
    }
    await symlink(root, packagePath, "dir");
    added.push(packagePath);
    await mkdir(probePath);
    added.push(probePath);
    await Bun.write(
      join(probePath, "chords/macos.toml"),
      `name = "Chordtest probe"\n[chords]\n'${readySequence}' = { name = "Ready", shell = ${JSON.stringify(`touch ${shellQuote(marker)}`)} }\n`,
    );
    await Bun.write(
      join(appData, "package-trust.json"),
      JSON.stringify({
        approvedPackages: await Promise.all(
          [packagePath, probePath].map(async (path) =>
            JSON.stringify([path, await realpath(path)]),
          ),
        ),
      }),
    );
    await Bun.write(
      join(appData, "app-state.json"),
      JSON.stringify({
        onboardingComplete: true,
        defaultGlobalPrefixForPlaceholders: ";",
        ...(process.env.CHORD_TESTING_DEBUG ? { logLevel: "debug" } : {}),
      }),
    );
    // An existing install without a saved default set is treated as having been offered the
    // current defaults. The VM should load only its test packages and the built-in Chord UI.
    await Bun.write(join(appData, "repos.json"), "{}");
    await rm(join(appData, "builtin-packages.json"), { force: true });
    const startChord = async () => {
      const start = (await Bun.file(log).exists()) ? Bun.file(log).size : 0;
      await Bun.write(workerStderr, "");
      await runCommand(["/usr/bin/open", "-g", "--stderr", workerStderr, appPath]);
      launched = true;
      await waitFor(async () => {
        if (!(await Bun.file(log).exists())) return;
        const output = await Bun.file(log).slice(start).text();
        if (
          output.includes("Keyboard event tap started") &&
          output.includes("Input ownership: active")
        )
          return true;
        await Bun.sleep(250);
      }, 30_000);
    };
    try {
      await startChord();
    } catch (firstError) {
      const firstStderr = await Bun.file(workerStderr)
        .text()
        .catch(() => "");
      await stop();
      console.warn("Chord did not acquire the keyboard event tap on startup. Retrying.");
      try {
        await startChord();
      } catch (secondError) {
        throw new AggregateError(
          [firstError, secondError],
          `Chord could not acquire the keyboard event tap after two starts. ${firstStderr.trim()}`,
        );
      }
    }
    await waitFor(async () => {
      if (await Bun.file(marker).exists()) return true;
      await app.run(readySequence).catch((error: unknown) => {
        if (!/exited with 143\b/.test(String(error))) throw error;
      });
      await Bun.sleep(350);
    }, 45_000);
    return await body(app);
  } catch (error) {
    const artifacts = process.env.CHORD_TESTING_ARTIFACTS;
    if (artifacts) {
      if (await Bun.file(log).exists())
        await Bun.write(join(artifacts, `${basename(root)}.chords.log`), Bun.file(log));
      if (Bun.file(workerStderr).size > 0)
        await Bun.write(join(artifacts, `${basename(root)}.worker.log`), Bun.file(workerStderr));
    }
    throw error;
  } finally {
    try {
      if (launched) await stop();
    } finally {
      await Promise.all(
        [...added, scratch].map((path) => rm(path, { recursive: true, force: true })),
      );
    }
  }
}
