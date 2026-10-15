import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, type TestContext } from "@chord/com.npmjs.vite-plus/test";

const script = fileURLToPath(import.meta.resolve("#list-cli"));

function discover(t: TestContext, manifests: Record<string, unknown>) {
  const base = mkdtempSync(join(tmpdir(), "chord-mirrors-"));
  t.onTestFinished(() => rmSync(base, { recursive: true, force: true }));
  for (const [name, manifest] of Object.entries(manifests)) {
    mkdirSync(join(base, name));
    if (manifest !== null) {
      writeFileSync(join(base, name, "package.json"), JSON.stringify(manifest));
    }
  }
  writeFileSync(join(base, "README.md"), "Not a directory");
  symlinkSync("README.md", join(base, "symlink"));
  return spawnSync(process.execPath, [script, base], { encoding: "utf8" });
}

test("every directory gets a KeyChord mirror regardless of manifest metadata", (t) => {
  const result = discover(t, {
    "local-folder": { repository: { url: "https://github.com/another-owner/different-repo" } },
    "new-package": {},
    chordtest: { private: true },
    assets: null,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    ["assets", "chordtest", "local-folder", "new-package"]
      .map((name) => `${name}\thttps://github.com/KeyChord/${name}\n`)
      .join(""),
  );
});

test("empty discovery succeeds and ignores files and symlinks", (t) => {
  const result = discover(t, {});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

test("invalid names and the source repository fail without emitting partial results", (t) => {
  for (const name of ["bad name", "bad\nname", ".hidden", "chords", "CHORDS"]) {
    const result = discover(t, { "a-valid": {}, [name]: {} });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /directory must name a unique GitHub mirror other than chords/);
  }
});
