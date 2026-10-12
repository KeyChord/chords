import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execaSync } from "@chord/com.npmjs.execa";
import { expect, test, onTestFinished } from "@chord/com.npmjs.vite-plus/test";

test.each([false, true])("sync uses the declared remote and only pushes in CI (%s)", (ci) => {
  const root = mkdtempSync(join(tmpdir(), "chords-sync-"));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, "source");
  const base = join(root, "packages");
  const addon = join(base, "local-name");
  const remote = join(root, "destination.git");
  mkdirSync(source);
  mkdirSync(addon, { recursive: true });
  const env = {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.com",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.file://${root}/.insteadOf`,
    GIT_CONFIG_VALUE_0: "https://github.com/test/",
    API_TOKEN_GITHUB: "",
    GITHUB_SHA: "HEAD",
    DEFAULT_BRANCH: "",
  };
  const git = execaSync({ cwd: source, env });
  git("git", ["init", "-b", "main"]);
  git("git", ["commit", "--allow-empty", "-m", "Source change"]);
  git("git", ["tag", "local-name-js-v1.2.3"]);
  git("git", ["init", "--bare", remote]);
  writeFileSync(
    join(addon, "package.json"),
    JSON.stringify({ repository: { url: "https://github.com/test/destination" } }),
  );
  writeFileSync(join(addon, "feature.txt"), "package content");

  execaSync(process.execPath, [fileURLToPath(import.meta.resolve("#sync-cli"))], {
    cwd: source,
    env: {
      ...env,
      BUILD_BASE: base,
      SOURCE_DIR: source,
      GITHUB_REF: "refs/heads/main",
      GITHUB_ACTOR: "test",
      CI: ci ? "1" : "",
      COMMIT_MESSAGE: "Mirror change",
    },
  });
  expect(git("git", ["-C", addon, "remote", "get-url", "origin"]).stdout).toBe(
    `file://${root}/destination`,
  );
  expect(git("git", ["-C", addon, "tag"]).stdout).toBe("v1.2.3");
  const refs = git("git", ["--git-dir", remote, "show-ref"], { reject: false });
  if (ci) {
    expect(refs.stdout).toContain("refs/heads/main");
    expect(
      git("git", ["--git-dir", remote, "show", "-s", "--format=%cn <%ce>", "main"]).stdout,
    ).toBe("improvebot <improvebot@users.noreply.github.com>");
    expect(refs.stdout).toContain("refs/tags/v1.2.3");
    expect(git("git", ["--git-dir", remote, "show", "main:feature.txt"]).stdout).toBe(
      "package content",
    );
  } else {
    expect(refs.stdout).toBe("");
  }
});
