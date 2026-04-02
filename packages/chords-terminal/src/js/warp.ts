import { generateSyntheticKeybinds } from "#/utils/keybinds.ts";
import fs from "fs";
import { expand } from "brace-expansion";
import { exists } from "#/utils/file.ts";
import yaml from "js-yaml";
import os from "os";
import path from "path";
import { tap, type BuilderThis } from "chord";

function extractCommands(chords: Record<string, any>): string[] {
  const result: string[] = [];

  for (const chord of Object.values(chords)) {
    if (chord?.args?.[0] && !chord.shortcut) {
      result.push(chord.args[0]);
    }
  }

  return result;
}

// TODO: call `setAppNeedsRelaunch` if we updated the keybindings
export default function buildWarpHandler(this: BuilderThis) {
  const commands = extractCommands(this.chordsFile.chords);

  const syntheticKeybinds = generateSyntheticKeybinds(
    commands,
    ["alt+shift+cmd+{0..9}", "ctrl+cmd+shift+{0..9}", "ctrl+alt+shift+{0..9}"].flatMap((pattern) =>
      expand(pattern),
    ),
  );

  // write warp keybindings
  const sortedCommands = Object.keys(syntheticKeybinds).sort();

  const keybindingsPath = path.join(os.homedir(), ".warp", "keybindings.yaml");
  let keybindings: Record<string, string> = {};
  if (exists(keybindingsPath)) {
    const yml = yaml.load(fs.readFileSync(keybindingsPath, "utf8"));
    if (typeof yml === "object" && yml !== null) {
      keybindings = yml as Record<string, string>;
    }
  }

  for (const cmd of sortedCommands) {
    // Warp uses - instead of + as their keybind separator
    const keybind = syntheticKeybinds[cmd]!.replaceAll("+", "-");
    keybindings[cmd] = keybind;
  }
  fs.writeFileSync(keybindingsPath, "---\n" + yaml.dump(keybindings));

  return function command(cmd: string): boolean {
    const keybind = keybindings[cmd];
    if (!keybind) {
      return false;
    }

    tap(keybind.replaceAll("-", "+"));
    return true;
  };
}
