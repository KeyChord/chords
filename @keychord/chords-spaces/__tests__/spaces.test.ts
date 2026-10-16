import { expect, test } from "bun:test";

const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, { shortcut?: string }> };

test("Space chords use Mission Control shortcuts", () => {
  for (const input of ["/s[", "/sl"]) expect(definition.chords[input].shortcut).toBe("ctrl+left");
  for (const input of ["/s]", "/sr"]) expect(definition.chords[input].shortcut).toBe("ctrl+right");
  for (let index = 1; index <= 9; index++)
    expect(definition.chords[`/s${index}`].shortcut).toBe(`ctrl+${index}`);
});
