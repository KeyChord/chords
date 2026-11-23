import { expect, test } from "bun:test";

const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as {
  placeholders: Record<string, { name: string; default: string }>;
  chords: Record<string, { "@input:space"?: string[] }>;
};

test("every chord and hint starts with the <> prefix, which defaults to ;s", () => {
  expect(definition.placeholders).toEqual({ "<>": { name: "Space prefix", default: "s" } });
  expect(
    Object.keys(definition.chords).filter((key) => !key.replace(/^\?/, "").startsWith("<>")),
  ).toEqual([]);
});

test("Space chords select the adjacent Space or numbered desktop", () => {
  for (const input of ["<>[", "<>l"])
    expect(definition.chords[input]["@input:space"]).toEqual(["PREVIOUS"]);
  for (const input of ["<>]", "<>r"])
    expect(definition.chords[input]["@input:space"]).toEqual(["NEXT"]);
  for (let index = 1; index <= 9; index++)
    expect(definition.chords[`<>${index}`]["@input:space"]).toEqual([String(index)]);
});
