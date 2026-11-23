import { tap } from "chord";
import { chordPattern, type ChordPlaceholders } from "@keychord/chordtest/patterns";
import { mocked } from "@keychord/chordtest/test";
import { expect, test } from "bun:test";
import buildKeysHandler from "../js/keys.js";

type ModifierManifest = {
  on: { keys: { file: string } };
  placeholders: ChordPlaceholders;
  chords: Record<string, { "@input:keys"?: string[] }>;
};

test.each(["linux", "windows"])(
  "%s modifier chords use the portable tap path",
  async (platform) => {
    const { chords, on, placeholders } = Bun.TOML.parse(
      await Bun.file(new URL(`../chords/${platform}.toml`, import.meta.url)).text(),
    ) as ModifierManifest;
    expect(on.keys.file).toBe("keys.js");
    const bindings = Object.entries(chords)
      .filter(([, chord]) => chord["@input:keys"]?.[0] === "$1")
      .map(([pattern]) => chordPattern(pattern, placeholders));
    expect(bindings).toHaveLength(4);

    const keys = buildKeysHandler();
    for (const [input, expected] of [
      [";kafcms", "alt+ctrl+cmd+shift+f"],
      [";kcv", "ctrl+v"],
      [";kmv", "cmd+v"],
      [";ksv", "shift+v"],
    ]) {
      const matches = bindings.flatMap((pattern) => pattern.exec(input)?.[1] ?? []);
      expect(matches).toHaveLength(1);
      mocked(tap).mockClear();
      mocked(tap).mockImplementation(() => {});
      expect(keys(matches[0])).toBeUndefined();
      expect(tap).toHaveBeenCalledWith(expected);
    }

    for (const input of [";kfv", ";kmvf"]) {
      expect(bindings.some((pattern) => pattern.test(input))).toBe(false);
    }
  },
);
