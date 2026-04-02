import arrayUnique from "array-uniq";
import zip from "just-zip-it";

export function generateSyntheticKeybinds(commands: string[], keybinds: string[]) {
  const sortedKeybinds = arrayUnique(keybinds).sort();
  const sortedCommands = arrayUnique(commands).sort();

  // deterministic mapping
  return Object.fromEntries(zip(sortedCommands, sortedKeybinds));
}
