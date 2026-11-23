import { chmod, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fixtureDigest, runCommand } from "./macos";

/** Copy a real Chord executable and its embedded Bun library for the macOS guest. */
export async function prepareChordHost(workspace: string, destination: string) {
  const app = process.env.CHORD_TESTING_APP ?? "/Applications/Chord.app";
  const bundleExecutable = "Contents/MacOS/chord";
  const candidates = process.env.CHORD_TESTING_HOST
    ? [process.env.CHORD_TESTING_HOST]
    : [
        join(workspace, "../Chord/apps/chord-tauri/src-tauri/target/debug/chord"),
        join(app, bundleExecutable),
      ];
  const executable = candidates.find(
    (path) => Bun.spawnSync(["/bin/test", "-x", path]).exitCode === 0,
  );
  if (!executable) {
    throw new Error(
      "Build Chord first, or set CHORD_TESTING_HOST to its executable. VM tests use the real embedded runtime.",
    );
  }
  const libraries = process.env.CHORD_TESTING_BUN_LIBRARY
    ? [process.env.CHORD_TESTING_BUN_LIBRARY]
    : [join(dirname(executable), "../Frameworks/libbun_embed.dylib")];
  const library = libraries.find((path) => Bun.spawnSync(["/bin/test", "-f", path]).exitCode === 0);
  if (!library) throw new Error("Cannot locate libbun_embed.dylib; set CHORD_TESTING_BUN_LIBRARY.");
  await mkdir(join(destination, "MacOS"), { recursive: true });
  await mkdir(join(destination, "Frameworks"), { recursive: true });
  await Bun.write(join(destination, "MacOS/chord"), Bun.file(executable));
  await Bun.write(join(destination, "Frameworks/libbun_embed.dylib"), Bun.file(library));
  await chmod(join(destination, "MacOS/chord"), 0o755);
  if (await Bun.file(join(app, "Contents/Info.plist")).exists())
    await runCommand(["/usr/bin/ditto", app, join(destination, "Chord.app")]);
  // The signed release seals Info.plist as part of its signature. macOS rejects
  // its bare executable even when its embedded Bun dylib is present.
  const runtimeExecutable =
    executable === join(app, bundleExecutable)
      ? join("Chord.app", bundleExecutable)
      : "MacOS/chord";
  await Bun.write(join(destination, "host-executable"), runtimeExecutable);

  const probe = join(destination, "macos-probe");
  await rm(probe, { force: true });
  if (Bun.spawnSync(["/usr/bin/xcode-select", "-p"]).exitCode === 0) {
    // Assemble the small shared fixture once with a deployment target that can run in both guests.
    await runCommand(
      [
        "/usr/bin/swiftc",
        "-target",
        "arm64-apple-macosx14.0",
        join(workspace, "@keychord/chordtest/src/fixtures/MacOSProbe.swift"),
        "-o",
        probe,
      ],
      { timeout: 120_000 },
    );
    const fixtures = join(destination, "fixtures");
    await mkdir(fixtures, { recursive: true });
    const packages = new Bun.Glob("@keychord/*/__tests__/*Fixture.swift");
    const shared = new Bun.Glob("@keychord/chordtest/src/fixtures/*Fixture.swift");
    for (const path of [
      ...packages.scanSync({ cwd: workspace }),
      ...shared.scanSync({ cwd: workspace }),
    ]) {
      const source = join(workspace, path);
      const binary = join(fixtures, await fixtureDigest(source));
      if (await Bun.file(binary).exists()) continue;
      try {
        await runCommand(
          [
            "/usr/bin/swiftc",
            "-target",
            "arm64-apple-macosx14.0",
            "-parse-as-library",
            source,
            "-o",
            binary,
          ],
          { timeout: 120_000 },
        );
      } catch {
        // A fixture using a newer SDK can be compiled by the guest's own toolchain.
        await rm(binary, { force: true });
      }
    }
  }
}
