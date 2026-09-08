import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import { execaSync } from "@chord/com.npmjs.execa";
import { listMirrors } from "#list-mirrors";

export function syncMirrors(env: NodeJS.ProcessEnv = process.env): void {
  // BUILD_BASE, GITHUB_REF and GITHUB_ACTOR are required. CI enables pushes.
  // Optional: API_TOKEN_GITHUB, SOURCE_DIR, COMMIT_MESSAGE, GITHUB_SHA,
  // GITHUB_REPOSITORY, GITHUB_RUN_ID and DEFAULT_BRANCH.
  if (!env.BUILD_BASE) throw new Error("BUILD_BASE must be set");
  const base = resolve(env.BUILD_BASE);
  if (!statSync(base).isDirectory()) throw new Error(`${base} is not a directory`);
  if (!env.GITHUB_REF?.startsWith("refs/heads/")) {
    throw new Error(`Could not determine branch name from ${env.GITHUB_REF}`);
  }
  if (!env.GITHUB_ACTOR) throw new Error("GITHUB_ACTOR must be set");
  const branch = env.GITHUB_REF.slice("refs/heads/".length);
  // Validate every destination before creating any repositories.
  const mirrors = listMirrors(base);
  if (!mirrors.length) {
    console.log("Nothing to do, no packages declare repository.url.");
    return;
  }

  const sourceGit = execaSync({ cwd: env.SOURCE_DIR || process.cwd() });
  const sha = env.GITHUB_SHA || "HEAD";
  const message =
    env.COMMIT_MESSAGE ||
    `${sourceGit("git", ["show", "-s", "--format=%B", sha]).stdout}\n\nCommitted via a GitHub action: https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  const author = sourceGit("git", ["show", "-s", "--format=%an <%ae>", sha]).stdout;
  const tags = sourceGit("git", ["tag", "--points-at", sha]).stdout.split("\n").filter(Boolean);
  const commitMessage = `${message}\n\nCo-authored-by: ${env.GITHUB_ACTOR} <${env.GITHUB_ACTOR}@users.noreply.github.com>`;
  const gitEnv: Record<string, string> = env.CI
    ? {
        GIT_AUTHOR_NAME: "improvebot",
        GIT_AUTHOR_EMAIL: "improvebot@users.noreply.github.com",
        GIT_COMMITTER_NAME: "improvebot",
        GIT_COMMITTER_EMAIL: "improvebot@users.noreply.github.com",
      }
    : {};

  if (env.API_TOKEN_GITHUB) {
    // Git reads the auth header from the environment, keeping credentials out of
    // command arguments, error messages and the package's on-disk git config.
    const header = Buffer.from(`x-access-token:${env.API_TOKEN_GITHUB}`).toString("base64");
    gitEnv.GIT_CONFIG_COUNT = "1";
    gitEnv.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
    gitEnv.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${header}`;
  }

  for (const { name, url } of mirrors) {
    console.log(`\nMirror: ${name}`);
    const git = execaSync({ cwd: join(base, name), env: gitEnv });
    try {
      git("git", ["init", "-b", branch, "."]);
      git("git", ["remote", "add", "origin", url]);
      git("git", ["ls-remote", "-h", "origin"]);
      const fetch = (ref: string) =>
        git(
          "git",
          [
            "-c",
            "protocol.version=2",
            "fetch",
            "--no-tags",
            "--prune",
            "--no-recurse-submodules",
            "--depth=1",
            "origin",
            ref,
          ],
          { reject: false },
        );
      let forceCommit = false;
      if (!fetch(branch).failed) {
        git("git", ["reset", "--soft", "FETCH_HEAD"]);
      } else {
        forceCommit = true;
        if (env.DEFAULT_BRANCH && !fetch(env.DEFAULT_BRANCH).failed) {
          git("git", ["reset", "--soft", "FETCH_HEAD"]);
        }
      }
      git("git", ["add", "-A"]);
      if (!forceCommit && !git("git", ["status", "--porcelain"]).stdout) {
        console.log(`No changes, skipping ${name}`);
        continue;
      }
      git("git", [
        "commit",
        ...(forceCommit ? ["--allow-empty"] : []),
        `--author=${author}`,
        "-m",
        commitMessage,
      ]);
      if (env.CI) git("git", ["push", "origin", branch]);
      console.log(`${url}/commit/${git("git", ["rev-parse", "HEAD"]).stdout}`);
      for (const fullTag of tags) {
        if (!fullTag.startsWith(`${name}-js-v`)) continue;
        const tag = fullTag.slice(`${name}-js-`.length);
        git("git", ["tag", tag, "-m", commitMessage]);
        if (env.CI) git("git", ["push", "origin", tag]);
      }
      console.log(`Completed ${name}`);
    } catch (error) {
      console.error(`::error::Mirror ${name} failed`, error);
      process.exitCode = 1;
    }
  }
}
