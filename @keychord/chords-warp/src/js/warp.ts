import { generateSyntheticKeybinds } from "./utils/keybinds";
import { expand } from "brace-expansion";
import { dump, FAILSAFE_SCHEMA, load, loadAll } from "js-yaml";
import { tap, type BuilderThis } from "chord";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

function configuredKeybindingsPath(): string {
  if (process.platform === "win32") {
    const root = Bun.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    return join(root, "warp", "Warp", "config", "keybindings.yaml");
  }
  const xdg = Bun.env.XDG_CONFIG_HOME;
  const root = xdg && isAbsolute(xdg) ? xdg : join(homedir(), ".config");
  return join(root, "warp-terminal", "keybindings.yaml");
}

// Chord injects the base key and Shift separately for shifted punctuation.
const shiftedKeys = new Map(
  Object.entries({
    "~": "`",
    "!": "1",
    "@": "2",
    "#": "3",
    $: "4",
    "%": "5",
    "^": "6",
    "&": "7",
    "*": "8",
    "(": "9",
    ")": "0",
    _: "-",
    "+": "=",
    "{": "[",
    "}": "]",
    "|": "\\",
    ":": ";",
    '"': "'",
    "<": ",",
    ">": ".",
    "?": "/",
  }),
);
const warpModifiers = new Set(["alt", "cmd", "ctrl", "meta", "shift", "super"]);

function configuredShortcut(binding: string): string {
  return binding
    .trim()
    .split(/\s+/)
    .map((keystroke) => {
      const separator = keystroke.endsWith("--")
        ? keystroke.length - 2
        : keystroke === "-"
          ? -1
          : keystroke.lastIndexOf("-");
      const modifiers = separator < 0 ? [] : keystroke.slice(0, separator).split("-");
      const key = keystroke.slice(separator + 1).toLowerCase();
      if (!key || modifiers.some((modifier) => !warpModifiers.has(modifier))) {
        throw new Error(`Invalid Warp shortcut: ${binding}`);
      }
      const unshifted = shiftedKeys.get(key);
      if (unshifted && !modifiers.includes("shift")) modifiers.push("shift");
      return [...modifiers, unshifted ?? (key === "numpadenter" ? "NumpadEnter" : key)].join("+");
    })
    .join(" ");
}

function configuredWarpHandler(keybindingsPath: string) {
  return async function command(action: string, defaultShortcut?: string): Promise<boolean> {
    const contents = await Bun.file(keybindingsPath)
      .text()
      .catch((error: unknown) => {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return "";
        throw error;
      });
    const documents = loadAll(contents, null, { schema: FAILSAFE_SCHEMA });
    const keybindings = documents[0];
    if (
      documents.length > 1 ||
      (keybindings && (typeof keybindings !== "object" || Array.isArray(keybindings)))
    ) {
      throw new Error(`Invalid Warp keybindings file: ${keybindingsPath}`);
    }
    const binding =
      keybindings && Object.hasOwn(keybindings, action)
        ? (keybindings as Record<string, unknown>)[action]
        : undefined;
    if (binding !== undefined && typeof binding !== "string") {
      throw new Error(`Invalid Warp keybinding for ${action}`);
    }
    const shortcut =
      binding === undefined
        ? defaultShortcut
        : binding === "none"
          ? undefined
          : configuredShortcut(binding);
    if (!shortcut) throw new Error(`Assign a keyboard shortcut to ${action} in Warp's settings.`);
    await tap(shortcut);
    return true;
  };
}

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
export default async function buildWarpHandler(
  this: BuilderThis,
  mode?: "configured",
  keybindingsPath?: string,
) {
  if (mode === "configured") {
    return configuredWarpHandler(keybindingsPath ?? configuredKeybindingsPath());
  }
  const commands = extractCommands(this.chordsFile.chords);

  const syntheticKeybinds = generateSyntheticKeybinds(
    commands,
    ["alt+shift+cmd+{0..9}", "ctrl+cmd+shift+{0..9}", "ctrl+alt+shift+{0..9}"].flatMap((pattern) =>
      expand(pattern),
    ),
  );

  // write warp keybindings
  const sortedCommands = Object.keys(syntheticKeybinds).sort();

  const macKeybindingsPath = `${Bun.env.HOME}/.warp/keybindings.yaml`;
  let keybindings: Record<string, string> = {};
  if (await Bun.file(macKeybindingsPath).exists()) {
    const yml = load(await Bun.file(macKeybindingsPath).text());
    if (typeof yml === "object" && yml !== null) {
      keybindings = yml as Record<string, string>;
    }
  }

  for (const cmd of sortedCommands) {
    // Warp uses - instead of + as their keybind separator
    const keybind = syntheticKeybinds[cmd]!.replaceAll("+", "-");
    keybindings[cmd] = keybind;
  }
  await Bun.write(macKeybindingsPath, "---\n" + dump(keybindings));

  return function command(cmd: string): boolean {
    const keybind = keybindings[cmd];
    if (!keybind) {
      return false;
    }

    tap(keybind.replaceAll("-", "+"));
    return true;
  };
}
