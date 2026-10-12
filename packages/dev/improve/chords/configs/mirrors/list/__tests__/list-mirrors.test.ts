import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
  return spawnSync(process.execPath, [script, base], { encoding: "utf8" });
}

test("discovers destinations independently of package names and skips unconfigured directories", (t) => {
  const result = discover(t, {
    "local-folder": { repository: { url: "https://github.com/another-owner/different-repo.git" } },
    "new-package": { repository: { url: "https://github.com/KeyChord/new-package/" } },
    disabled: {},
    assets: null,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    "local-folder\thttps://github.com/another-owner/different-repo\nnew-package\thttps://github.com/KeyChord/new-package\n",
  );
});

test("empty discovery succeeds", (t) => {
  const result = discover(t, { disabled: {} });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

test("invalid destinations fail without emitting partial results", (t) => {
  for (const url of [
    null,
    "",
    42,
    "https://example.com/owner/repo",
    "https://github.com/owner/repo/tree/main",
  ]) {
    const result = discover(t, {
      "a-valid": { repository: { url: "https://github.com/KeyChord/valid" } },
      "z-invalid": { repository: { url } },
    });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /repository.url must be a GitHub HTTPS repository URL/);
  }
});
