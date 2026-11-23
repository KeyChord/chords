import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  chordPattern,
  expandPlaceholders,
  type ChordPlaceholders,
} from "@keychord/chordtest/patterns";

type Binding = { name?: string; shell?: string; [key: string]: unknown };
type ChordsFile = {
  placeholders: Record<string, { name?: string; default?: string }>;
  chords: Record<string, Binding>;
};

const root = join(import.meta.dir, "..");
const read = async (path: string) => Bun.TOML.parse(await Bun.file(path).text()) as ChordsFile;
const definition = await read(join(root, "chords/macos.toml"));
const rift = await read(join(root, "../chords-rift/chords/macos.toml"));
const hints = Object.entries(definition.chords).filter(([input]) => input.startsWith("?"));
const chords = Object.entries(definition.chords).filter(([input]) => !input.startsWith("?"));
// Chord replaces `<>` with the prefix chosen in Settings, or else this default.
const prefix = expandPlaceholders("<>", definition.placeholders);
const expand = (input: string) => input.replace("<>", prefix);

test("every chord and hint starts with the <> prefix, which defaults to ;a", () => {
  expect(definition.placeholders).toEqual({
    "<>": { name: "Window management prefix", default: "a" },
  });
  const unprefixed = Object.keys(definition.chords).filter(
    (input) => !input.replace(/^\?/, "").startsWith("<>"),
  );
  expect(unprefixed).toEqual([]);
});

test("every key is one chords-rift uses, so switching window managers keeps the layout", () => {
  const extra = Object.keys(definition.chords).filter((input) => !(input in rift.chords));
  expect(extra).toEqual([]);
});

test("every chord runs exactly one aerospace command", () => {
  expect(chords.length).toBeGreaterThan(0);
  for (const [input, binding] of chords) {
    expect({ input, keys: Object.keys(binding).sort() }).toEqual({
      input,
      keys: ["name", "shell"],
    });
    expect(binding.name?.trim()).toBeTruthy();
    expect(binding.shell).toMatch(/^aerospace [a-z-]+(?: [^;&|`$<>]*)?$/);
  }
});

test("the Windows bindings dispatch the same supported commands through aerospace.exe", async () => {
  const windows = await read(join(root, "chords/windows.toml"));
  expect(windows.placeholders).toEqual(definition.placeholders);
  expect(Object.keys(windows.chords).sort()).toEqual(Object.keys(definition.chords).sort());
  for (const [input, { shell }] of chords) {
    expect(windows.chords[input].shell).toBe(shell!.replace(/^aerospace /, "aerospace.exe "));
  }
});

test("relative workspace commands opt out of stdin, which Chord's shell never has", () => {
  // Without a terminal, `workspace next|prev` and `move-node-to-workspace next|prev` fail with
  // "Implicit stdin is detected" unless --stdin or --no-stdin is given.
  const relative = chords.filter(([, { shell }]) =>
    /^aerospace (?:workspace|move-node-to-workspace) .*\b(?:next|prev)$/.test(shell!),
  );
  expect(relative.length).toBeGreaterThan(0);
  for (const [input, { shell }] of relative) {
    expect({ input, shell }).toEqual({ input, shell: expect.stringContaining(" --no-stdin ") });
  }
});

test("hints only name prefixes of real chords", () => {
  for (const [hint, binding] of hints) {
    expect(Object.keys(binding)).toEqual(["name"]);
    const pattern = hint.slice(1);
    const extended = chords.some(
      ([input]) => input.length > pattern.length && input.startsWith(pattern),
    );
    expect({ hint, extended }).toEqual({ hint, extended: true });
  }
});

test("workspace digits are AeroSpace workspace names", () => {
  for (let index = 0; index <= 9; index++) {
    expect(definition.chords[`<>w${index}`].shell).toBe(`aerospace workspace ${index}`);
    expect(definition.chords[`<>m${index}`].shell).toBe(
      `aerospace move-node-to-workspace ${index}`,
    );
    expect(definition.chords[`<>f${index}`].shell).toBe(
      `aerospace move-node-to-workspace --focus-follows-window ${index}`,
    );
  }
});

test("no chord collides with another package that can be enabled alongside AeroSpace", async () => {
  // Rift is another tiling window manager with the same layout; nobody runs both.
  // Compares with the default prefix; a prefix chosen in Settings is the user's to keep clear.
  const alternatives = new Set(["@keychord/chords-rift", "@keychord/chords-aerospace"]);
  const packages = join(root, "..");
  const collisions: string[] = [];
  for (const path of new Bun.Glob("*/chords/macos.toml").scanSync({ cwd: packages })) {
    const directory = join(packages, path, "../..");
    const manifest = Bun.file(join(directory, "package.json"));
    if (!(await manifest.exists())) continue;
    const { name } = (await manifest.json()) as { name?: string };
    if (!name?.startsWith("@keychord/") || alternatives.has(name)) continue;
    const other = Bun.TOML.parse(await Bun.file(join(packages, path)).text()) as {
      placeholders?: ChordPlaceholders;
      chords?: Record<string, unknown>;
    };
    for (const key of Object.keys(other.chords ?? {})) {
      if (key.startsWith("?")) continue;
      const pattern = chordPattern(key, other.placeholders);
      for (const [input] of chords)
        if (pattern.test(expand(input))) collisions.push(`${expand(input)} (${name})`);
    }
  }
  expect(collisions).toEqual([]);
});

// The aerospace CLI parses its arguments before it connects to AeroSpace. With outbound
// connections denied by the sandbox, every command stops at the connection, so this can't
// reach a running AeroSpace; a typo fails earlier with "Can't parse".
test.skipIf(!Bun.which("aerospace") || !Bun.which("sandbox-exec"))(
  "the installed aerospace CLI accepts every command",
  async () => {
    const profile = "(version 1)(allow default)(deny network-outbound)";
    const results = await Promise.all(
      chords.map(async ([input, { shell }]) => {
        const child = Bun.spawn(["sandbox-exec", "-p", profile, "/bin/sh", "-c", shell!], {
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          timeout: 15_000,
        });
        const [stdout, stderr, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        return { input, code, output: `${stdout}${stderr}`.trim() };
      }),
    );
    const rejected = results.filter(
      ({ code, output }) => code !== 2 || !output.startsWith("Can't connect to AeroSpace server"),
    );
    expect(rejected).toEqual([]);
  },
  60_000,
);
