import { readdirSync } from "node:fs";

export type Mirror = { name: string; url: string };

export function listMirrors(base: string): Mirror[] {
  const mirrors: Mirror[] = [];

  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(entry.name) ||
      entry.name.toLowerCase() === "chords" ||
      mirrors.some(({ name }) => name.toLowerCase() === entry.name.toLowerCase())
    ) {
      throw new Error(
        `${base}/${entry.name}: directory must name a unique GitHub mirror other than chords`,
      );
    }
    mirrors.push({ name: entry.name, url: `https://github.com/KeyChord/${entry.name}` });
  }

  return mirrors.sort((a, b) => a.name.localeCompare(b.name));
}
