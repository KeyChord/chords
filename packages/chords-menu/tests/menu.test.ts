import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vite-plus/test";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

test("the -0 binding sends index zero and preserves the captured application", async () => {
  const nativeAction = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(process, "dlopen").mockImplementation((module) => {
    module.exports = { runMenuAction: nativeAction };
  });
  const { default: buildMenuHandler } = await import("../src/js/menu.ts");
  const source = readFileSync(new URL("../chords/macos.toml", import.meta.url), "utf8");
  const binding = source.match(/^'-0'.*'emit:menu' = \['by-index', '([0-9]+)'\]/m);
  expect(binding?.[1]).toBe("0");
  const menu = buildMenuHandler();
  await menu.call({ focusedAppId: "dev.keychord.fixture" }, "by-index", binding![1]);
  expect(nativeAction).toHaveBeenCalledWith("dev.keychord.fixture", "by-index", "0");
});
