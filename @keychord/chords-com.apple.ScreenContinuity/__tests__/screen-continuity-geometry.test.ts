import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

test.skipIf(process.platform !== "darwin")(
  "native device bounds exclude chrome across zoom, orientation and display origins",
  () => {
    const scratch = mkdtempSync(join(tmpdir(), "chord-device-geometry-"));
    try {
      const binary = join(scratch, "device-geometry");
      execFileSync(
        "swiftc",
        [
          "-parse-as-library",
          fileURLToPath(
            new URL("../src/swift/screen-continuity/DeviceGeometry.swift", import.meta.url),
          ),
          fileURLToPath(new URL("./DeviceGeometryTests.swift", import.meta.url)),
          "-o",
          binary,
        ],
        { timeout: 60_000 },
      );
      expect(execFileSync(binary, { encoding: "utf8", timeout: 5_000 })).toContain(
        "device-geometry-ok",
      );
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  },
  65_000,
);
