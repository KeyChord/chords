import { readFileSync } from "node:fs";
import { tap } from "chord";
import { chordPattern } from "@keychord/chordtest/patterns";
import { beforeEach, expect, test, vi } from "vite-plus/test";
import buildKeysHandler, { modifierShortcut } from "../src/js/keys";

const source = readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8");
const bindings = Array.from(
  source.matchAll(/^'([^']+)' = .*'@input:keys' = \['(\$\d+)'\]/gm),
  ([, pattern, argument]) => ({ pattern: chordPattern(pattern), argument }),
);
const letters = ["a", "c", "f", "m", "s"];
const nativeModifiers = ["alt", "ctrl", "fn", "cmd", "shift"];
const combinations = Array.from({ length: 31 }, (_, index) => index + 1).flatMap((mask) => {
  const selected = letters.filter((_, index) => mask & (1 << index));
  return selected.map((entry) => ({
    entry,
    suffix: selected.filter((letter) => letter !== entry).join(""),
    modifiers: nativeModifiers.filter((_, index) => mask & (1 << index)).join("+"),
  }));
});
const regularKeys = "abcdefghijklmnopqrstuvwxyz0123456789`-=[]\\;',./";

function capture(input: string): string {
  const matches = bindings.flatMap(({ pattern, argument }) => {
    const match = pattern.exec(input);
    return match ? [match[Number(argument.slice(1))]] : [];
  });
  expect(matches).toHaveLength(1);
  return matches[0];
}

function permutations(value: string): string[] {
  if (!value) return [""];
  return [...value].flatMap((letter, index) =>
    permutations(value.slice(0, index) + value.slice(index + 1)).map((rest) => letter + rest),
  );
}

beforeEach(() => {
  vi.mocked(tap).mockImplementation(() => {});
});

test("all five modifier entry points capture a key followed by optional modifiers", () => {
  expect(source).toMatch(/\[on\.keys\]\s+file = 'keys\.js'/);
  expect(bindings.map(({ pattern }) => pattern.source)).toEqual(
    ["m", "c", "a", "f", "s"].map((entry) => chordPattern(`.(${entry}.[acfms]*)`).source),
  );
  for (const letter of letters) expect(source).toContain(`'?.${letter}' = `);
});

test.each([
  [".mv", "cmd+v"],
  [".mvs", "cmd+shift+v"],
  [".mcsa", "alt+cmd+shift+c"],
  [".mcas", "alt+cmd+shift+c"],
  [".ms", "cmd+s"],
  [".mm", "cmd+m"],
  [".mc", "cmd+c"],
  [".ma", "cmd+a"],
  [".mf", "cmd+f"],
  [".cc", "ctrl+c"],
  [".ss", "shift+s"],
  [".m-", "cmd+-"],
])("%s sends %s", (input, shortcut) => {
  buildKeysHandler()(capture(input));
  expect(tap).toHaveBeenCalledExactlyOnceWith(shortcut);
});

test.each(combinations)(
  ".$entryv$suffix supports $modifiers with every suffix order",
  ({ entry, suffix, modifiers }) => {
    for (const ordering of permutations(suffix)) {
      vi.mocked(tap).mockClear();
      buildKeysHandler()(capture(`.${entry}v${ordering}`));
      expect(tap).toHaveBeenCalledExactlyOnceWith(`${modifiers}+v`);
    }
  },
);

test.each(letters)(".%s treats the next character as a literal regular key", (entry) => {
  for (const key of regularKeys) {
    vi.mocked(tap).mockClear();
    buildKeysHandler()(capture(`.${entry}${key}`));
    expect(tap).toHaveBeenCalledExactlyOnceWith(
      `${nativeModifiers[letters.indexOf(entry)]}+${key}`,
    );
  }
});

test("repeated modifiers are applied only once, including the entry modifier", () => {
  expect(modifierShortcut(capture(".mcsmasas"))).toBe("alt+cmd+shift+c");
  expect(modifierShortcut(capture(".mvmmss"))).toBe("cmd+shift+v");
});

test.each([
  ".",
  ...letters.map((letter) => `.${letter}`),
  ".mcv",
  ".-x",
  ".-",
  ",mv",
  "xmv",
  "j.mv",
  ".mvz",
  ".m-v",
  ".ms-v",
  ".b20l30",
  ".t20l30",
  ".l30t20",
  ".r30t20",
])("modifier mappings leave incomplete, invalid, and click input unmatched: %s", (input) => {
  expect(bindings.some(({ pattern }) => pattern.test(input))).toBe(false);
});

test.each([
  "",
  "-c",
  "m",
  "vc",
  "mcv",
  "m-v",
  "ms-v",
  "mc+v",
  "mc v",
  "mc\nv",
  "mc\n",
  "mc😀",
  "m😀",
  "mC",
  "m ",
  "m\n",
  "mvS",
])("invalid input rejects the entire sequence before native input: %s", (sequence) => {
  expect(() => buildKeysHandler()(sequence)).toThrow(TypeError);
  expect(tap).not.toHaveBeenCalled();
});

test("native input failures propagate", () => {
  vi.mocked(tap).mockImplementation(() => {
    throw new Error("Accessibility denied");
  });
  expect(() => buildKeysHandler()("mv")).toThrow("Accessibility denied");
});
