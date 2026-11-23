import { join } from "node:path";
import { expect, test } from "bun:test";
import { chordPattern, expandPlaceholders, type ChordPlaceholders } from "../patterns";

type Binding = { fallback?: boolean };
type ChordsFile = { placeholders?: ChordPlaceholders; chords?: Record<string, Binding> };

const root = Bun.fileURLToPath(new URL("../../../../", import.meta.url));
// A package's root chords file holds its global chords; app chords live in nested folders.
const packages = await Promise.all(
  [...new Bun.Glob("@keychord/*/chords/macos.toml").scanSync({ cwd: root })]
    .sort()
    .map(async (path) => {
      const file = Bun.TOML.parse(await Bun.file(join(root, path)).text()) as ChordsFile;
      const keys = Object.entries(file.chords ?? {}).map(([raw, binding]) => ({
        raw,
        key: expandPlaceholders(raw, file.placeholders),
        binding,
      }));
      return { name: path.split(/[\\/]/)[1]!, file, keys };
    }),
);

const slashBindings = [
  "/f: chords-com.apple.finder",
  "/,: chords-com.apple.systempreferences",
  "/(.*) (fallback): chords-com.apple.Spotlight",
  "/(.*) (fallback): chords-raycast",
];

test("global bindings declare a <> prefix with a letter or a literal / default", () => {
  expect(packages.length).toBeGreaterThan(20);
  for (const { name, file, keys } of packages) {
    if (keys.length === 0) continue;
    const prefix = file.placeholders?.["<>"];
    expect(prefix, name).toBeDefined();
    expect(typeof prefix, name).toBe("object");
    if (!prefix || typeof prefix === "string") continue;
    expect(prefix.default, name).toMatch(/^(?:[a-z]|\/)$/);
    for (const { raw } of keys) expect(raw, name).toMatch(/^\??<>/);
  }
});

test("/ holds only /f, /, and the /<query> launcher", () => {
  const launch = packages.flatMap(({ name, keys }) =>
    keys
      .filter(({ key }) => key.startsWith("/"))
      .map(({ key, binding }) => `${key}${binding.fallback ? " (fallback)" : ""}: ${name}`),
  );
  expect(launch.sort()).toEqual(slashBindings.sort());
});

test("no two packages bind the same chord with their default prefixes", () => {
  const collisions: string[] = [];
  for (const first of packages)
    for (const second of packages) {
      if (first === second) continue;
      for (const { key, binding } of first.keys) {
        // Launchers are fallbacks by design. Compare identical patterns and literal inputs.
        if (key.startsWith("?") || binding.fallback) continue;
        for (const other of second.keys) {
          if (other.key.startsWith("?") || other.binding.fallback) continue;
          if (
            key === other.key ||
            (!key.includes("(") && chordPattern(other.raw, second.file.placeholders).test(key))
          )
            collisions.push(`${key}: ${first.name} and ${second.name} (${other.key})`);
        }
      }
    }
  expect(collisions).toEqual([]);
});
