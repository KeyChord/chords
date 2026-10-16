#!/usr/bin/env bun
import { Octokit } from "@octokit/rest";
import * as path from "node:path";
import { parse, stringify } from "smol-toml";
import { join } from "desm";

interface PackageConfig {
  name: string;
  git: string;
}

const packageConfigs: PackageConfig[] = [
  {
    name: "@keychord/chords-chord",
    git: "https://github.com/KeyChord/chords-chord",
  },
  {
    name: "@keychord/chords-modifiers",
    git: "https://github.com/KeyChord/chords-modifiers",
  },
  {
    name: "@keychord/chords-menu",
    git: "https://github.com/KeyChord/chords-menu",
  },
  {
    name: "@keychord/chords-com.apple",
    git: "https://github.com/KeyChord/chords-com.apple",
  },
  {
    name: "@keychord/chords-finder",
    git: "https://github.com/KeyChord/chords-finder",
  },
];

async function updatePackageRevisions(): Promise<void> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const chordpackPath = path.join(process.cwd(), "chordpack.toml");
  let chordpack: any = {
    name: "Chord's default chordpack",
    packages: {},
  };

  try {
    if (await Bun.file(chordpackPath).exists()) {
      const existingContent = await Bun.file(chordpackPath).text();
      chordpack = parse(existingContent);
    }
  } catch {
    console.warn("Could not parse existing chordpack.toml, proceeding with defaults.");
  }

  delete chordpack.packages["@keychord/chords-tray"];

  for (const pkgConfig of packageConfigs) {
    const parts = pkgConfig.git.replace("https://github.com/", "").split("/");
    const owner = parts[0];
    const repo = parts[1];

    try {
      const { data } = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });

      if (data && data.length > 0) {
        const rev = data[0].sha;
        chordpack.packages[pkgConfig.name] = {
          git: pkgConfig.git,
          rev,
        };
        console.log(`Updated ${pkgConfig.name} to ${rev}`);
      }
    } catch (error) {
      console.error(`Failed to update ${pkgConfig.name}:`, (error as any).message || error);
    }
  }

  const output = stringify(chordpack);
  await Bun.write(chordpackPath, output);
  let maybe = join(import.meta.url, "../../Chord/data/chordpack.toml");
  if (await Bun.file(maybe).exists()) {
    await Bun.write(maybe, output);
  }

  console.log(`Updated ${chordpackPath}`);
}

updatePackageRevisions();
