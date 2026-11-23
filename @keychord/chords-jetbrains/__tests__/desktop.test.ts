import { expect, test } from "bun:test";

type ChordsFile = {
  name: string;
  executables?: string[];
  import?: { file: string }[];
  chords?: Record<string, { name: string; shortcut?: string }>;
};

async function readChords(path: string): Promise<ChordsFile> {
  const url = new URL(`../chords/${path}`, import.meta.url);
  return Bun.TOML.parse(await Bun.file(url).text()) as ChordsFile;
}

test.each(["linux", "windows"] as const)("all JetBrains IDEs have %s chords", async (platform) => {
  const directory = Bun.fileURLToPath(new URL("../chords/", import.meta.url));
  const macFiles = new Bun.Glob("com/jetbrains/*/macos.toml").scanSync(directory);
  const claimed = new Set<string>();
  for (const path of macFiles) {
    const mac = await readChords(path);
    const desktop = await readChords(path.replace(/macos\.toml$/, `${platform}.toml`));
    expect(desktop.name).toBe(mac.name);
    expect(desktop.import).toEqual([{ file: `base-${platform}.toml` }]);
    expect(desktop.executables?.length).toBeGreaterThan(0);
    for (const executable of desktop.executables ?? []) {
      expect(executable.endsWith(".exe")).toBe(platform === "windows");
      expect(claimed.has(executable)).toBe(false);
      claimed.add(executable);
    }
  }
  expect(claimed.size).toBeGreaterThan(10);
});

test("desktop keymaps share standard shortcuts and retain platform differences", async () => {
  const [shared, linux, windows] = await Promise.all(
    ["base.desktop.toml", "base-linux.toml", "base-windows.toml"].map(readChords),
  );
  expect(shared.chords?.sf.shortcut).toBe("ctrl+shift+n");
  expect(shared.chords?.eq.shortcut).toBe("ctrl+f4");
  for (const platform of [linux, windows]) {
    expect(platform.import).toEqual([{ file: "base.desktop.toml" }]);
  }
  expect(linux.chords?.us.shortcut).toBe("ctrl+alt+7");
  expect(windows.chords?.us.shortcut).toBe("ctrl+alt+f7");
});
