import * as chord from "chord";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { createModuleNamespace } from "../module-namespace";

const temporary: string[] = [];
function fixturePackage() {
  const root = mkdtempSync(join(tmpdir(), "chord-test-runtime-"));
  temporary.push(root);
  writeFileSync(join(root, "package.json"), "{}");
  return root;
}
afterEach(() =>
  temporary.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })),
);

test("the preloaded module exposes the native host API and rejects unconfigured actions", async () => {
  for (const name of [
    "click",
    "getAppWindows",
    "tap",
    "press",
    "release",
    "getGlobalHotkey",
    "registerGlobalHotkey",
    "setAppNeedsRelaunch",
    "onAppLaunch",
    "onAppTerminate",
    "runSudoCommand",
    "Applescript",
  ]) {
    expect(typeof chord[name as keyof typeof chord]).toBe("function");
  }
  await expect(chord.click({ windowId: 123, x: 1, y: 2 })).rejects.toThrow("not configured");
  expect(() => chord.tap("cmd+a")).toThrow("not configured");
});

test("callers can configure the imported native exports without production injection", async () => {
  vi.mocked(chord.click).mockResolvedValue(undefined);
  await chord.click({ windowId: 123, x: 10, y: 20 });
  expect(chord.click).toHaveBeenCalledExactlyOnceWith({ windowId: 123, x: 10, y: 20 });
});

test("the preload resets native mocks between tests", async () => {
  expect(chord.click).not.toHaveBeenCalled();
  await expect(chord.click({ windowId: 123, x: 10, y: 20 })).rejects.toThrow("not configured");
});

test("loaded modules receive package-bound import.meta helpers", () => {
  const meta = import.meta as ImportMeta & { chord: ReturnType<typeof createModuleNamespace> };
  expect(meta.chord.resolvePackageFile("package.json")).toBe(
    join(import.meta.dirname, "..", "..", "package.json"),
  );
  expect(meta.chord.resolveNative("menu")).toMatch(/\/target\/[^/]+\/menu\/menu\.node$/);
});

test("native modules and package files resolve relative to the caller's package", () => {
  const root = fixturePackage();
  const namespace = createModuleNamespace(join(root, "src/js/handler.ts"));
  expect(namespace.resolvePackageFile("chords/macos.toml")).toBe(join(root, "chords/macos.toml"));
  expect(namespace.resolveNative("native/beep")).toMatch(
    /\/target\/[^/]+\/native\/beep\/beep\.node$/,
  );
});

test("vendored handlers resolve the dependency's logical package", () => {
  const root = fixturePackage();
  const namespace = createModuleNamespace(join(root, "js/@keychord/chords-menu/js/menu.js"));
  expect(namespace.resolvePackageFile("chords/macos.toml")).toBe(
    join(root, "chords/@keychord/chords-menu/chords/macos.toml"),
  );
  expect(namespace.resolveNative("menu")).toContain("/target/@keychord/chords-menu/target/");
});

test("resolvers reject paths escaping the package or malformed native module paths", () => {
  const namespace = createModuleNamespace(join(fixturePackage(), "src/js/handler.ts"));
  for (const path of ["", "../file", "/tmp/file", "a/../file"]) {
    expect(() => namespace.resolvePackageFile(path)).toThrow();
  }
  for (const path of ["", "../menu", "/menu", "menu.node", "native/../menu", ".hidden/menu"]) {
    expect(() => namespace.resolveNative(path)).toThrow();
  }
});
