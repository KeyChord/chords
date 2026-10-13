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
const combinations = Array.from({ length: 31 }, (_, index) => index + 1).map((mask) => ({
  letters: letters.filter((_, index) => mask & (1 << index)).join(""),
  modifiers: nativeModifiers.filter((_, index) => mask & (1 << index)).join("+"),
}));

function capture(input: string): string {
  const matches = bindings.flatMap(({ pattern, argument }) => {
    const match = pattern.exec(input);
    return match ? [match[Number(argument.slice(1))]] : [];
  });
  expect(matches).toHaveLength(1);
  return matches[0];
}

beforeEach(() => {
  vi.mocked(tap).mockImplementation(() => {});
});

test("all five modifier entry points preserve the former command patterns", () => {
  expect(source).toMatch(/\[on\.keys\]\s+file = 'keys\.js'/);
  expect(bindings.map(({ pattern }) => pattern.source)).toEqual(
    [".(m[s]*-.*)", ".(c[fms]*-.*)", ".(a[cfms]*-.*)", ".(f[ms]*-.*)", ".(s-.*)"].map(
      (pattern) => chordPattern(pattern).source,
    ),
  );
  for (const letter of letters) expect(source).toContain(`'?.${letter}' = `);
});

test.each(combinations)(".$letters- forwards every regular key with $modifiers", (combo) => {
  const sequence = capture(`.${combo.letters}-cv`);
  expect(sequence).toBe(`${combo.letters}-cv`);
  buildKeysHandler()(sequence);
  expect(tap).toHaveBeenCalledExactlyOnceWith(`${combo.modifiers}+c ${combo.modifiers}+v`);
});

test.each(combinations)(".$letters- supports modifier-only input", (combo) => {
  buildKeysHandler()(capture(`.${combo.letters}-`));
  expect(tap).toHaveBeenCalledExactlyOnceWith(combo.modifiers);
});

test("the separator does not consume later punctuation or repeated regular keys", () => {
  buildKeysHandler()(capture(".m-cc-.;[],/\\'`="));
  expect(tap).toHaveBeenCalledExactlyOnceWith(
    "cmd+c cmd+c cmd+- cmd+. cmd+; cmd+[ cmd+] cmd+, cmd+/ cmd+\\ cmd+' cmd+` cmd+=",
  );
});

test("legacy repeated modifiers are accepted without duplicate native modifier presses", () => {
  expect(modifierShortcut(capture(".acsmss-x"))).toBe("alt+ctrl+shift+cmd+x");
  expect(modifierShortcut(capture(".mss-x"))).toBe("cmd+shift+x");
});

test.each([
  ".",
  ".m",
  ".mcv",
  ".-x",
  ".-",
  ",m-c",
  "xm-c",
  "j.m-c",
  ".mc-c",
  ".b20l30",
  ".t20l30",
  ".l30t20",
  ".r30t20",
])("modifier mappings leave incomplete, unmodified, and click input unmatched: %s", (input) => {
  expect(bindings.some(({ pattern }) => pattern.test(input))).toBe(false);
});

test.each(["-c", "m", "mc-c", "m-c+v", "m-c v", "m-c\nv", "m-c\n", "m-c😀", "m-C"])(
  "invalid input rejects the entire sequence before native input: %s",
  (sequence) => {
    expect(() => buildKeysHandler()(sequence)).toThrow(TypeError);
    expect(tap).not.toHaveBeenCalled();
  },
);

test("native input failures propagate", () => {
  vi.mocked(tap).mockImplementation(() => {
    throw new Error("Accessibility denied");
  });
  expect(() => buildKeysHandler()("m-c")).toThrow("Accessibility denied");
});
