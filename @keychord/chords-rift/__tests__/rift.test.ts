import { join } from "node:path";
import { expect, test } from "bun:test";
import {
  chordPattern,
  expandPlaceholders,
  type ChordPlaceholders,
} from "@keychord/chordtest/patterns";
import {
  FOCUS_MASTER,
  MOVE_BACKWARD,
  MOVE_FORWARD,
  MOVE_TO_BOTTOM,
  MOVE_TO_TOP,
  focusArgs,
  swapArgs,
} from "../src/js/rift";

type Binding = { name?: string; shell?: string; [key: string]: unknown };

const root = join(import.meta.dir, "..");
const definition = Bun.TOML.parse(await Bun.file(join(root, "chords/macos.toml")).text()) as {
  placeholders: Record<string, { name?: string; default?: string }>;
  on: Record<string, { file: string }>;
  chords: Record<string, Binding>;
};
const hints = Object.entries(definition.chords).filter(([input]) => input.startsWith("?"));
const chords = Object.entries(definition.chords).filter(([input]) => !input.startsWith("?"));
// `<>m` and the master/stack moves run the `rift` handler instead: Rift has no command for them.
const handled = chords.filter(([, binding]) => "@input:rift" in binding);
const shells = chords.filter(([, binding]) => !("@input:rift" in binding));
// A chord may chain commands with `&&`, so a failing command stops the rest.
const commands = (shell: string) => shell.split(" && ");
// Chord replaces `<>` with the prefix chosen in Settings, or else this default.
const prefix = expandPlaceholders("<>", definition.placeholders);
const expand = (input: string) => input.replace("<>", prefix);

test("every chord and hint starts with the <> prefix, which defaults to ;r", () => {
  expect(definition.placeholders).toEqual({
    "<>": { name: "Window management prefix", default: "r" },
  });
  const unprefixed = Object.keys(definition.chords).filter(
    (input) => !input.replace(/^\?/, "").startsWith("<>"),
  );
  expect(unprefixed).toEqual([]);
});

test("every chord runs only rift-cli commands, or the rift handler", () => {
  expect(shells.length).toBeGreaterThan(0);
  expect(handled).toEqual([
    ["<>m", { name: "Master (Window)", "@input:rift": [FOCUS_MASTER] }],
    ["<>f", { name: "Forwards (Move Window)", "@input:rift": [MOVE_FORWARD] }],
    ["<>k", { name: "Backwards (Move Window)", "@input:rift": [MOVE_BACKWARD] }],
    ["<>t", { name: "Top (Move Window)", "@input:rift": [MOVE_TO_TOP] }],
    ["<>b", { name: "Bottom (Move Window)", "@input:rift": [MOVE_TO_BOTTOM] }],
  ]);
  expect(definition.on).toEqual({ rift: { file: "rift.js" } });
  for (const [input, binding] of shells) {
    expect({ input, keys: Object.keys(binding).sort() }).toEqual({
      input,
      keys: ["name", "shell"],
    });
    expect(binding.name?.trim()).toBeTruthy();
    for (const command of commands(binding.shell!)) {
      expect(command).toMatch(/^rift-cli (?:execute [a-z-]+ [^;&|`$<>]*|service (?:start|stop))$/);
    }
  }
});

test("master-side layouts set the side before switching to master/stack", () => {
  for (const [input, side] of [
    ["<>lml", "left"],
    ["<>lmr", "right"],
  ]) {
    expect(commands(definition.chords[input].shell!)).toEqual([
      `rift-cli execute config set settings.layout.master_stack.master_side ${side}`,
      "rift-cli execute workspace set-layout master_stack",
    ]);
  }
});

test("Rift Config chords reload config and start or stop the service", () => {
  expect(definition.chords["?<>,"].name).toBe("Rift Config");
  expect(definition.chords["<>,r"].shell).toBe("rift-cli execute config reload");
  expect(definition.chords["<>,p"].shell).toBe("rift-cli service start");
  expect(definition.chords["<>,h"].shell).toBe("rift-cli service stop");
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

test("the built package includes the Rift prefix hint", async () => {
  const { chords: files } = await import("../js/package.json.js");
  expect(definition.chords["?<>"]).toEqual({ name: "Rift" });
  expect(files["macos.toml"].chords["?<>"]).toEqual(definition.chords["?<>"]);
});

test("workspace digits are Rift's 0-based workspace indexes", () => {
  for (let index = 0; index <= 9; index++) {
    expect(definition.chords[`<>w${index}`].shell).toBe(
      `rift-cli execute workspace switch ${index}`,
    );
    expect(definition.chords[`<>m${index}`].shell).toBe(
      `rift-cli execute workspace move-window ${index}`,
    );
    expect(definition.chords[`<>f${index}`].shell).toBe(
      `rift-cli execute workspace move-window ${index} --follow`,
    );
  }
});

test("no chord collides with another package that can be enabled alongside Rift", async () => {
  // AeroSpace is another tiling window manager with the same `<>` layout; nobody runs both.
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

// An unregistered Mach service name isolates commands that talk to Rift. Service commands
// manage launchd directly, so check those with --help to avoid changing the running service.
test.skipIf(!Bun.which("rift-cli"))(
  "the installed rift-cli accepts every command",
  async () => {
    const service = `dev.keychord.chords-rift.test.${process.pid}.${crypto.randomUUID()}`;
    // Without the service a chain stops at its first command, so run each one on its own.
    const runs = [
      ...shells.flatMap(([input, { shell }]) =>
        commands(shell!).map((command) => {
          const invocation = command.startsWith("rift-cli service ")
            ? `${command} --help`
            : command;
          return { input, command, argv: ["/bin/sh", "-c", invocation] };
        }),
      ),
      // The handler's commands, spawned directly as it does.
      ...[
        ["query", "layout"],
        focusArgs({ pid: 1, idx: 2 }),
        swapArgs({ pid: 1, idx: 2 }, { pid: 3, idx: 4 }),
      ].map((args) => ({
        input: "rift handler",
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
    const rejected = results.filter(({ command, code, output }) =>
      command.startsWith("rift-cli service ")
        ? code !== 0 || !output.includes(`Usage: ${command}`)
        : code !== 1 || !output.includes("Rift's Mach service is not registered"),
    );
    expect(rejected).toEqual([]);
  },
  60_000,
);
