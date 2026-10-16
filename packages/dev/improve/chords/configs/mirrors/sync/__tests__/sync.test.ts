import { existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execaSync } from "@chord/com.npmjs.execa";
import { expect, test, onTestFinished, vi } from "@chord/com.npmjs.vite-plus/test";
import { syncMirrors } from "#sync-mirrors";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "chords-sync-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source");
  const base = join(source, "@keychord");
  const addon = join(base, "new-package");
  const remotes = join(root, "remotes");
  const remote = join(remotes, "new-package");
  mkdirSync(addon, { recursive: true });
  mkdirSync(remotes);
  const env = {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.file://${remotes}/.insteadOf`,
    GIT_CONFIG_VALUE_0: "https://github.com/KeyChord/",
    API_TOKEN_GITHUB: "test-token",
    GITHUB_SHA: "HEAD",
    GITHUB_REF: "refs/heads/main",
    BUILD_BASE: base,
    SOURCE_DIR: source,
    CI: "1",
  };
  const git = execaSync({ cwd: source, env });
  git("git", ["init", "-b", "main"]);
  // No repository.url: adding the directory must be sufficient.
  writeFileSync(join(addon, "package.json"), JSON.stringify({ name: "@keychord/new-package" }));
  writeFileSync(join(addon, "feature.txt"), "committed content");
  writeFileSync(join(addon, "run.sh"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  symlinkSync("feature.txt", join(addon, "linked.txt"));
  git("git", ["add", "."]);
  git("git", ["commit", "-m", "Source change"]);
  git("git", ["tag", "new-package-js-v1.2.3"]);
  git("git", ["tag", "other-package-js-v9.9.9"]);
  const request = vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (init?.method === "GET") {
      return new Response("{}", { status: existsSync(remote) ? 200 : 404 });
    }
    if (init?.method === "POST") {
      expect(path).toBe("/orgs/KeyChord/repos");
      git("git", ["init", "--bare", "-b", "main", remote]);
    }
    return new Response("{}", { status: 200 });
  });
  return { root, source, addon, remote, git, env, request };
}

test.each([false, true])("automatically provisions mirrors only in CI (%s)", async (ci) => {
  const { addon, remote, git, env, request } = fixture();
  await syncMirrors({ ...env, CI: ci ? "1" : "" }, request);
  expect(existsSync(join(addon, ".git"))).toBe(false);
  if (!ci) {
    expect(request).not.toHaveBeenCalled();
    expect(existsSync(remote)).toBe(false);
    return;
  }
  const show = (...args: string[]) => git("git", ["--git-dir", remote, ...args]).stdout;
  expect(show("show", "main:feature.txt")).toBe("committed content");
  expect(show("show", "-s", "--format=%an <%ae>|%cn <%ce>", "main")).toBe(
    "Test <test@example.com>|improvebot <improvebot@users.noreply.github.com>",
  );
  expect(show("tag")).toBe("v1.2.3");
  expect(show("rev-parse", "v1.2.3^{}")).toBe(show("rev-parse", "main"));
  expect(show("ls-tree", "main", "run.sh")).toMatch(/^100755/);
  expect(show("ls-tree", "main", "linked.txt")).toMatch(/^120000/);
  expect(show("show", "main:linked.txt")).toBe("feature.txt");
  const creation = request.mock.calls.find(([, init]) => init?.method === "POST");
  expect(JSON.parse(String(creation?.[1]?.body))).toMatchObject({
    name: "new-package",
    private: false,
    has_issues: false,
    has_wiki: false,
  });
  const update = request.mock.calls.find(([, init]) => init?.method === "PATCH");
  expect(JSON.parse(String(update?.[1]?.body))).toMatchObject({ default_branch: "main" });
});

test("reruns discard mirror commits and moved tags without incorporating dirty source files", async () => {
  const { root, addon, remote, git, env, request } = fixture();
  await syncMirrors(env, request);
  const original = git("git", ["--git-dir", remote, "rev-parse", "main"]).stdout;
  const tag = git("git", ["--git-dir", remote, "rev-parse", "v1.2.3"]).stdout;
  const clone = join(root, "mirror-clone");
  git("git", ["clone", remote, clone]);
  writeFileSync(join(clone, "feature.txt"), "mirror-only edit");
  writeFileSync(join(clone, "extra.txt"), "mirror-only file");
  git("git", ["-C", clone, "add", "."]);
  git("git", ["-C", clone, "commit", "-m", "Must be overwritten"]);
  git("git", ["-C", clone, "tag", "--force", "v1.2.3"]);
  git("git", ["-C", clone, "push", "--force", "origin", "main", "--tags"]);
  writeFileSync(join(addon, "feature.txt"), "uncommitted source edit");
  writeFileSync(join(addon, "untracked.txt"), "untracked file");
  request.mockClear();
  await syncMirrors(env, request);
  const show = (...args: string[]) => git("git", ["--git-dir", remote, ...args]).stdout;
  expect(show("rev-parse", "main")).toBe(original);
  expect(show("rev-parse", "v1.2.3")).toBe(tag);
  expect(show("rev-list", "--count", "main")).toBe("1");
  expect(show("ls-tree", "--name-only", "main")).not.toMatch(/extra|untracked/);
  expect(show("show", "main:feature.txt")).toBe("committed content");
  expect(request.mock.calls.map(([, init]) => init?.method)).toEqual(["GET", "PATCH"]);

  // Source deletions and additions also replace the entire previous mirror tree.
  git("git", [
    "rm",
    "--force",
    "@keychord/new-package/feature.txt",
    "@keychord/new-package/linked.txt",
  ]);
  writeFileSync(join(addon, "replacement.txt"), "new source content");
  git("git", ["add", "@keychord/new-package/replacement.txt"]);
  git("git", ["commit", "-m", "Replace feature"]);
  await syncMirrors(env, request);
  expect(show("ls-tree", "--name-only", "main")).not.toMatch(/feature|linked|extra|untracked/);
  expect(show("show", "main:replacement.txt")).toBe("new source content");
});

test("missing credentials or a non-main ref fail before any remote access", async () => {
  const { env, request } = fixture();
  await expect(syncMirrors({ ...env, API_TOKEN_GITHUB: "" }, request)).rejects.toThrow(
    "API_TOKEN_GITHUB must be set in CI",
  );
  await expect(syncMirrors({ ...env, GITHUB_REF: "refs/heads/feature" }, request)).rejects.toThrow(
    "Mirrors can only be synced from refs/heads/main",
  );
  expect(request).not.toHaveBeenCalled();
});

test.each([401, 403, 500])(
  "API errors fail without attempting repository creation (%s)",
  async (status) => {
    const { remote, env } = fixture();
    const request = vi.fn<typeof fetch>(async () => new Response("{}", { status }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    onTestFinished(() => log.mockRestore());
    await expect(syncMirrors(env, request)).rejects.toThrow("Failed to sync mirrors: new-package");
    expect(request).toHaveBeenCalledTimes(1);
    expect(existsSync(remote)).toBe(false);
  },
);
