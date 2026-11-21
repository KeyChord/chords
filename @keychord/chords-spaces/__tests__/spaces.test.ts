import { expect, test } from "bun:test";

const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as {
  placeholders: Record<string, { name: string; default: string }>;
  chords: Record<string, { shortcut?: string }>;
};

test("every chord and hint starts with the <> prefix, which defaults to ;s", () => {
  expect(definition.placeholders).toEqual({ "<>": { name: "Space prefix", default: "s" } });
  expect(
    Object.keys(definition.chords).filter((key) => !key.replace(/^\?/, "").startsWith("<>")),
  ).toEqual([]);
});

test("Space chords use Mission Control shortcuts", () => {
  for (const input of ["<>[", "<>l"]) expect(definition.chords[input].shortcut).toBe("ctrl+left");
  for (const input of ["<>]", "<>r"]) expect(definition.chords[input].shortcut).toBe("ctrl+right");
  for (let index = 1; index <= 9; index++)
    expect(definition.chords[`<>${index}`].shortcut).toBe(`ctrl+${index}`);
});
