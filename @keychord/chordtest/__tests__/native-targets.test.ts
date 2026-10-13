import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeTestTargets } from "../src/macos";

test("VM addon names match the config builder for multiword Swift products", async () => {
  const root = await mkdtemp(join(tmpdir(), "chordtest-native-targets-"));
  try {
    await Bun.write(
      join(root, "Package.swift"),
      `.library(name: "KeychordChordsComAppleNativeScreenContinuity", type: .dynamic, targets: ["ScreenContinuity"]),
.library(name: "KeychordChordsMenuNativeMenu", type: .dynamic, targets: ["Menu"]),`,
    );
    expect(await nativeTestTargets(root)).toEqual([
      { product: "KeychordChordsComAppleNativeScreenContinuity", name: "screenContinuity" },
      { product: "KeychordChordsMenuNativeMenu", name: "menu" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
