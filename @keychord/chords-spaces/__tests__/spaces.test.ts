import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";

const definition = JSON.parse(
  execFileSync(
    "bun",
    ["-e", "console.log(JSON.stringify(Bun.TOML.parse(await Bun.stdin.text())))"],
    {
      input: readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8"),
      encoding: "utf8",
    },
  ),
) as { chords: Record<string, { shortcut?: string }> };

test("Space chords use Mission Control shortcuts", () => {
  for (const input of ["/s[", "/sl"]) expect(definition.chords[input].shortcut).toBe("ctrl+left");
  for (const input of ["/s]", "/sr"]) expect(definition.chords[input].shortcut).toBe("ctrl+right");
  for (let index = 1; index <= 9; index++)
    expect(definition.chords[`/s${index}`].shortcut).toBe(`ctrl+${index}`);
});
