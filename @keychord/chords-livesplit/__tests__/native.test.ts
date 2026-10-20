import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bridgeLibrary, buildBridge } from "../scripts/build-bridge";

const canBuild =
  process.platform === "darwin" &&
  Bun.spawnSync(["/usr/bin/xcrun", "--find", "clang"], { stdout: "ignore", stderr: "ignore" })
    .exitCode === 0;

// Mach-O UUIDs and signatures change on every build, so compare the disassembly, dropping
// otool's first line, which names the input file.
function code(path: string): string {
  const output = Bun.spawnSync(["/usr/bin/otool", "-tV", path], { stdout: "pipe", stderr: "pipe" });
  if (output.exitCode !== 0) throw new Error(output.stderr.toString());
  return output.stdout.toString().split("\n").slice(1).join("\n");
}

test.skipIf(!canBuild)(
  "the committed bridge library matches its Objective-C source",
  async () => {
    const directory = mkdtempSync(join(tmpdir(), "livesplit-bridge-"));
    try {
      const rebuilt = await buildBridge(join(directory, "livesplit-bridge.dylib"));
      expect(code(rebuilt)).toBe(code(bridgeLibrary));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  },
  60_000,
);
