import { join } from "node:path";
import { expect, test } from "bun:test";
import { chordPattern } from "@keychord/chordtest/patterns";
import { FOCUS_MASTER, focusArgs } from "../src/js/rift";

type Binding = { name?: string; shell?: string; [key: string]: unknown };

const root = join(import.meta.dir, "..");
const definition = Bun.TOML.parse(await Bun.file(join(root, "chords/macos.toml")).text()) as {
  placeholders: Record<string, { name?: string; default?: string }>;
  on: Record<string, { file: string }>;
  chords: Record<string, Binding>;
};
const hints = Object.entries(definition.chords).filter(([input]) => input.startsWith("?"));
const chords = Object.entries(definition.chords).filter(([input]) => !input.startsWith("?"));
// `<p>m` runs the `rift` handler instead: Rift has no command that focuses the master window.
const handled = chords.filter(([, binding]) => "@input:rift" in binding);
const shells = chords.filter(([, binding]) => !("@input:rift" in binding));
// A chord may chain commands with `&&`, so a failing command stops the rest.
const commands = (shell: string) => shell.split(" && ");
// Chord replaces `<p>` with the prefix chosen in Settings, or else this default.
const prefix = definition.placeholders.p?.default ?? "";
const expand = (input: string) => input.replace("<p>", prefix);

test("every chord and hint starts with the <p> prefix, which defaults to ;", () => {
  expect(definition.placeholders).toEqual({
    p: { name: "Window management prefix", default: ";" },
  });
  const unprefixed = Object.keys(definition.chords).filter(
    (input) => !input.replace(/^\?/, "").startsWith("<p>"),
  );
  expect(unprefixed).toEqual([]);
});

test("every chord runs only rift-cli commands, or the rift handler", () => {
  expect(shells.length).toBeGreaterThan(0);
  expect(handled).toEqual([["<p>m", { name: "Master (Window)", "@input:rift": [FOCUS_MASTER] }]]);
  expect(definition.on).toEqual({ rift: { file: "rift.js" } });
  for (const [input, binding] of shells) {
    expect({ input, keys: Object.keys(binding).sort() }).toEqual({
      input,
      keys: ["name", "shell"],
    });
    expect(binding.name?.trim()).toBeTruthy();
    for (const command of commands(binding.shell!)) {
      expect(command).toMatch(/^rift-cli execute [a-z-]+ [^;&|`$<>]*$/);
    }
  }
});

test("master-side layouts set the side before switching to master/stack", () => {
  for (const [input, side] of [
    ["<p>lml", "left"],
    ["<p>lmr", "right"],
  ]) {
    expect(commands(definition.chords[input].shell!)).toEqual([
      `rift-cli execute config set settings.layout.master_stack.master_side ${side}`,
      "rift-cli execute workspace set-layout master_stack",
    ]);
  }
});

test("hints only name prefixes of real chords", () => {
  for (const [hint, binding] of hints) {
    expect(Object.keys(binding)).toEqual(["name"]);
    const prefix = hint.slice(1);
    const extended = chords.some(
      ([input]) => input.length > prefix.length && input.startsWith(prefix),
    );
    expect({ hint, extended }).toEqual({ hint, extended: true });
  }
});

test("workspace digits are Rift's 0-based workspace indexes", () => {
  for (let index = 0; index <= 9; index++) {
    expect(definition.chords[`<p>w${index}`].shell).toBe(
      `rift-cli execute workspace switch ${index}`,
    );
    expect(definition.chords[`<p>m${index}`].shell).toBe(
      `rift-cli execute workspace move-window ${index}`,
    );
    expect(definition.chords[`<p>f${index}`].shell).toBe(
      `rift-cli execute workspace move-window ${index} --follow`,
    );
  }
});

test("no chord collides with another package that can be enabled alongside Rift", async () => {
  // AeroSpace is another tiling window manager with the same `;` layout; nobody runs both.
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
      chords?: Record<string, unknown>;
    };
    for (const key of Object.keys(other.chords ?? {})) {
      if (key.startsWith("?")) continue;
      const pattern = chordPattern(key);
      for (const [input] of chords)
        if (pattern.test(expand(input))) collisions.push(`${expand(input)} (${name})`);
    }
  }
  expect(collisions).toEqual([]);
});

// Run every command through `sh -c`, as Chord does, against the installed rift-cli. An
// unregistered Mach service name keeps it from reaching the running Rift: a command that
// parses gets as far as looking up the service, while a typo fails earlier with usage text.
test.skipIf(!Bun.which("rift-cli"))(
  "the installed rift-cli accepts every command",
  async () => {
    const service = `dev.keychord.chords-rift.test.${process.pid}.${crypto.randomUUID()}`;
    // Without the service a chain stops at its first command, so run each one on its own.
    const runs = [
      ...shells.flatMap(([input, { shell }]) =>
        commands(shell!).map((command) => ({ input, command, argv: ["/bin/sh", "-c", command] })),
      ),
      // The handler's two commands, spawned directly as it does.
      ...[["query", "layout"], focusArgs({ pid: 1, idx: 2 })].map((args) => ({
        input: "<p>m",
        command: `rift-cli ${args.join(" ")}`,
        argv: ["rift-cli", ...args],
      })),
    ];
    const results = await Promise.all(
      runs.map(async ({ input, command, argv }) => {
        const child = Bun.spawn(argv, {
          env: { ...process.env, RIFT_BS_NAME: service },
          stdout: "pipe",
          stderr: "pipe",
          timeout: 15_000,
        });
        const [stdout, stderr, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        return { input, command, code, output: `${stdout}${stderr}`.trim() };
      }),
    );
    const rejected = results.filter(
      ({ code, output }) => code !== 1 || !output.includes("Rift's Mach service is not registered"),
    );
    expect(rejected).toEqual([]);
  },
  60_000,
);
