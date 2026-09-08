import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaSync } from "@chord/com.npmjs.execa";

export function checkNativeArtifacts(): number {
  if (process.platform !== "darwin") {
    console.log("[native-check] not macOS, skipping native artifact check");
    return 0;
  }

  const root = execaSync("git", ["rev-parse", "--show-toplevel"]).stdout;
  const run = execaSync({ cwd: root });
  const addons = run("git", ["ls-files", "-z", "--", "*.node"]).stdout.split("\0").filter(Boolean);
  const temporary = mkdtempSync(join(tmpdir(), "chords-native-"));
  // Mach-O UUIDs/signatures change on every build. Compare disassembled code,
  // removing otool's first line, which contains the input filename.
  const codeOf = (path: string) =>
    run("otool", ["-tV", path]).stdout.split("\n").slice(1).join("\n");
  const snapshots = new Map<string, { code: string; original: Buffer }>();

  try {
    for (const addon of addons) {
      const committed = run("git", ["show", `HEAD:${addon}`], {
        encoding: "buffer",
        reject: false,
      });
      if (committed.failed) continue; // Newly added addons have no HEAD version.
      const path = join(temporary, "committed.node");
      writeFileSync(path, committed.stdout);
      snapshots.set(addon, { code: codeOf(path), original: readFileSync(join(root, addon)) });
    }

    run("moon", ["run", ":build-native"], { stdio: "inherit" });
    const stale = [...snapshots]
      .filter(([addon, before]) => codeOf(addon) !== before.code)
      .map(([addon]) => addon);
    if (stale.length) {
      console.error("::error::Committed native artifacts are out of date with src/swift/.");
      console.error(
        `Rebuilding produced different machine code for:\n${stale.map((addon) => `  ${addon}`).join("\n")}`,
      );
      console.error("Stage the rebuilt artifacts and commit again:\n    git add packages/*/target");
      return 1;
    }

    // Restore only the checked addons to their pre-check bytes, preserving any
    // local edits and leaving other target files untouched.
    for (const [addon, { original }] of snapshots) writeFileSync(join(root, addon), original);
    console.log("[native-check] native artifacts are up to date");
    return 0;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
