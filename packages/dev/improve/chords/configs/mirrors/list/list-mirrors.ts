import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Mirror = { name: string; url: string };

export function listMirrors(base: string): Mirror[] {
  const mirrors: Mirror[] = [];

  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = join(base, entry.name, "package.json");
    if (!existsSync(manifest)) continue;

    const { repository } = JSON.parse(readFileSync(manifest, "utf8"));
    if (repository?.url === undefined) continue;
    const url = repository.url;
    if (
      typeof url !== "string" ||
      !/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+(?:\/)?$/.test(url)
    ) {
      throw new Error(`${manifest}: repository.url must be a GitHub HTTPS repository URL`);
    }
    if (/[\t\r\n]/.test(entry.name)) {
      throw new Error(`${manifest}: package directory must not contain tabs or newlines`);
    }
    mirrors.push({ name: entry.name, url: url.replace(/\/$/, "").replace(/\.git$/, "") });
  }

  return mirrors.sort((a, b) => a.name.localeCompare(b.name));
}
