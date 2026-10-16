import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";

const root = new URL("../../../../", import.meta.url);
const constant = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

test("chord dispatch uses SCREAMING_SNAKE_CASE for internal action identifiers", () => {
  const entries: { file: string; handler: string; action: unknown }[] = JSON.parse(
    execFileSync(
      "bun",
      [
        "-e",
        `
    const entries = [];
    for (const file of new Bun.Glob("@keychord/*/chords/**/*.toml").scanSync()) {
      const definitions = Bun.TOML.parse(await Bun.file(file).text());
      for (const binding of Object.values(definitions.chords ?? {})) {
        for (const [event, args] of Object.entries(binding)) {
          const handler = /^@(?:input|keydown):(.+)$/.exec(event)?.[1];
          if (!handler || !Array.isArray(args) || !args.length) continue;
          const record = index => entries.push({ file, handler, action: args[index] });
          if (["whatsapp", "spotify", "youtube", "instagram", "menu", "appearance", "select", "window"].includes(handler)) record(0);
          if (handler === "window" && args[0] === "PRESET") record(1);
          if (handler === "click") record(1);
          if (handler === "tray") {
            record(0);
            if (typeof args[1] === "string" && !/^[-0-9$]/.test(args[1])) record(1);
            if (args[2]) record(2);
          }
          if (handler === "monitor" && file.startsWith("@keychord/chords-monitors/")) {
            if (typeof args[0] === "string" && !/^[-0-9$]/.test(args[0])) record(0);
            if (args[1]) record(1);
          }
          if (handler === "js" && file.startsWith("@keychord/chords-web/")) record(0);
        }
      }
    }
    console.log(JSON.stringify(entries));
  `,
      ],
      { cwd: root, encoding: "utf8" },
    ),
  );
  expect(entries.length).toBeGreaterThan(100);
  for (const { file, handler, action } of entries) {
    expect(action, `${file}: ${handler}`).toMatch(constant);
  }
});

test("source action unions use the same convention", () => {
  const packages = new URL("@keychord/", root);
  for (const entry of readdirSync(packages)) {
    if (!entry.startsWith("chords-")) continue;
    const sources = new URL(`${entry}/src/`, packages);
    let files: string[];
    try {
      files = readdirSync(sources, { recursive: true, encoding: "utf8" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const file of files.filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))) {
      const source = readFileSync(new URL(file, sources), "utf8");
      for (const match of source.matchAll(
        /\btype\s+(\w*Action|ClickKind|TrayClickType)\s*=([^;]+);/g,
      )) {
        for (const literal of match[2].matchAll(/["']([A-Za-z][\w-]*)["']/g)) {
          expect(literal[1], `${join(entry, "src", file)}: ${match[1]}`).toMatch(constant);
        }
      }
    }
  }
});
