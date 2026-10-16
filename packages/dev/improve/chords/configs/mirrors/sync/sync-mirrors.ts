import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { execaSync } from "@chord/com.npmjs.execa";
import { listMirrors } from "@chord/dev.improve.chords.configs.mirrors.list";

// Node also runs this CLI in GitHub Actions, so keep the Node filesystem APIs.
export async function syncMirrors(
  env: NodeJS.ProcessEnv = process.env,
  request: typeof fetch = fetch,
): Promise<void> {
  if (!env.BUILD_BASE) throw new Error("BUILD_BASE must be set");
  const base = resolve(env.BUILD_BASE);
  if (!statSync(base).isDirectory()) throw new Error(`${base} is not a directory`);
  if (env.GITHUB_REF !== "refs/heads/main") {
    throw new Error("Mirrors can only be synced from refs/heads/main");
  }
  if (env.CI && !env.API_TOKEN_GITHUB) throw new Error("API_TOKEN_GITHUB must be set in CI");

  const source = resolve(env.SOURCE_DIR || process.cwd());
  const prefix = relative(source, base).split("\\").join("/");
  if (!prefix || prefix === ".." || prefix.startsWith("../") || isAbsolute(prefix)) {
    throw new Error("BUILD_BASE must be inside SOURCE_DIR");
  }
  // Validate every destination before making any remote changes.
  const mirrors = listMirrors(base);
  const sourceGit = execaSync({ cwd: source, env });
  const sha = sourceGit("git", [
    "rev-parse",
    "--verify",
    `${env.GITHUB_SHA || "HEAD"}^{commit}`,
  ]).stdout;
  const message = sourceGit("git", ["show", "-s", "--format=%B", sha]).stdout;
  const author = sourceGit("git", ["show", "-s", "--format=%an <%ae>", sha]).stdout;
  const authorDate = sourceGit("git", ["show", "-s", "--format=%aI", sha]).stdout;
  const commitDate = sourceGit("git", ["show", "-s", "--format=%cI", sha]).stdout;
  const tags = sourceGit("git", ["tag", "--points-at", sha]).stdout.split("\n").filter(Boolean);
  // Exclude run IDs and wall-clock time so replaying the same source is idempotent.
  const commitMessage = `${message}\n\nSource: https://github.com/KeyChord/chords/commit/${sha}`;
  const gitEnv: NodeJS.ProcessEnv = {
    ...env,
    GIT_AUTHOR_DATE: authorDate,
    GIT_COMMITTER_DATE: commitDate,
    GIT_COMMITTER_NAME: "improvebot",
    GIT_COMMITTER_EMAIL: "improvebot@users.noreply.github.com",
  };
  if (env.API_TOKEN_GITHUB) {
    // Keep credentials out of arguments, errors and on-disk Git configuration.
    const index = Number(env.GIT_CONFIG_COUNT || process.env.GIT_CONFIG_COUNT || "0");
    const header = Buffer.from(`x-access-token:${env.API_TOKEN_GITHUB}`).toString("base64");
    gitEnv.GIT_CONFIG_COUNT = String(index + 1);
    gitEnv[`GIT_CONFIG_KEY_${index}`] = "http.https://github.com/.extraheader";
    gitEnv[`GIT_CONFIG_VALUE_${index}`] = `AUTHORIZATION: basic ${header}`;
  }

  const failures: string[] = [];
  for (const { name, url } of mirrors) {
    console.log(`Mirror: ${name}${env.CI ? "" : " (dry run)"}`);
    const scratch = mkdtempSync(join(tmpdir(), "chords-mirror-"));
    try {
      // Export committed files only, preserving modes and symlinks. Neither a local
      // build nor mirror-only commits can leak into the authoritative snapshot.
      const archive = sourceGit("git", ["archive", "--format=tar", `${sha}:${prefix}/${name}`], {
        encoding: "buffer",
      }).stdout;
      const git = execaSync({ cwd: scratch, env: gitEnv });
      git("tar", ["-xf", "-"], { input: archive });
      git("git", ["init", "-b", "main", "."]);
      git("git", ["add", "--force", "--all"]);
      git("git", ["commit", "--allow-empty", `--author=${author}`, "-m", commitMessage]);
      const tagRefs = tags
        .filter((tag) => tag.startsWith(`${name}-js-v`))
        .map((tag) => {
          const version = tag.slice(`${name}-js-`.length);
          git("git", ["tag", version, "-m", commitMessage]);
          return `refs/tags/${version}:refs/tags/${version}`;
        });
      if (env.CI) {
        const api = async (path: string, method = "GET", body?: unknown) => {
          const response = await request(`https://api.github.com${path}`, {
            method,
            headers: {
              Accept: "application/vnd.github+json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.API_TOKEN_GITHUB}`,
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok && !(method === "GET" && response.status === 404)) {
            throw new Error(`GitHub ${method} ${path} failed (${response.status})`);
          }
          return response;
        };
        const repo = `/repos/KeyChord/${name}`;
        const settings = {
          description: `Read-only mirror of KeyChord/chords/@keychord/${name}. Direct commits are overwritten; contribute to KeyChord/chords.`,
          homepage: `https://github.com/KeyChord/chords/tree/main/@keychord/${name}`,
          has_issues: false,
          has_projects: false,
          has_wiki: false,
          has_discussions: false,
        };
        if ((await api(repo)).status === 404) {
          await api("/orgs/KeyChord/repos", "POST", { name, private: false, ...settings });
        }
        // The mirror is never a parent. Force replaces divergent or unrelated history.
        git("git", ["push", "--force", url, "refs/heads/main:refs/heads/main", ...tagRefs]);
        // An empty repository cannot select main as its default until after the push.
        await api(repo, "PATCH", { ...settings, default_branch: "main" });
      }
      console.log(`Completed ${name}: ${git("git", ["rev-parse", "HEAD"]).stdout}`);
    } catch (error) {
      console.error(`::error::Mirror ${name} failed`, error);
      failures.push(name);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  if (failures.length) throw new Error(`Failed to sync mirrors: ${failures.join(", ")}`);
}
