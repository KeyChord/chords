import { chmod, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Copy a real Chord executable and its embedded Bun library for the macOS guest. */
export async function prepareChordHost(workspace: string, destination: string) {
  const candidates = process.env.CHORD_TESTING_HOST
    ? [process.env.CHORD_TESTING_HOST]
    : [
        join(workspace, "../Chord/apps/chord-tauri/src-tauri/target/debug/chord"),
        "/Applications/Chord.app/Contents/MacOS/chord",
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
}
