import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireMacOSVM } from "@keychord/chordtest/runtime";
import { runCommand } from "@keychord/chordtest/macos";
import buildMonitorHandler from "../js/monitor.js";

requireMacOSVM();
const directory = await mkdtemp(join(tmpdir(), "chord-monitor-modes-"));
try {
  const binary = join(directory, "modes");
  await runCommand(
    [
      "swiftc",
      Bun.fileURLToPath(new URL("./MonitorModesProbe.swift", import.meta.url)),
      "-o",
      binary,
    ],
    { timeout: 60_000 },
  );
  const state = async (): Promise<{ display: number; current: number[]; available: number[][] }> =>
    JSON.parse((await runCommand([binary])).stdout);
  const initial = await state();
  const handler = buildMonitorHandler();
  await handler(initial.current.join("x"), "SIZE");
  assert.deepEqual((await state()).current, initial.current);
  await assert.rejects(
    handler("2000x200", "SIZE"),
    /Unsupported monitor resolution.*Available resolutions/s,
  );
  assert.deepEqual((await state()).current, initial.current);
  const alternate = initial.available.find((mode) =>
    mode.some((value, index) => value !== initial.current[index]),
  );
  if (alternate) {
    try {
      await handler(alternate.join("x"), "SIZE");
      assert.deepEqual((await state()).current, alternate);
    } finally {
      await handler(initial.current.join("x"), "SIZE");
    }
    assert.deepEqual((await state()).current, initial.current);
    console.log(
      "monitor-resolution-macos-ok: changed and restored supported mode; rejected unsupported mode",
    );
  } else
    console.log(
      "monitor-resolution-macos-ok: current mode and unsupported rejection; VM exposes only one resolution",
    );
} finally {
  await rm(directory, { recursive: true, force: true });
}
