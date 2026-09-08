import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi, onTestFinished } from "@chord/com.npmjs.vite-plus/test";

const execaSync = vi.fn();
vi.doMock("@chord/com.npmjs.execa", () => ({ execaSync }));
const { checkNativeArtifacts } = await import("#check-native-artifacts");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  execaSync.mockReset();
});

test("skips native tools outside macOS", () => {
  vi.stubGlobal("process", { ...process, platform: "linux" });
  expect(checkNativeArtifacts()).toBe(0);
  expect(execaSync).not.toHaveBeenCalled();
});

test.each([false, true])(
  "compares machine code and preserves local bytes when unchanged (stale=%s)",
  (stale) => {
    vi.stubGlobal("process", { ...process, platform: "darwin" });
    const root = mkdtempSync(join(tmpdir(), "native-check-test-"));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const addon = join(root, "addon.node");
    writeFileSync(addon, "local bytes before check");
    const run = vi.fn((command: string, args: string[]) => {
      if (command === "git" && args[0] === "ls-files") return { stdout: "addon.node\0" };
      if (command === "git" && args[0] === "show")
        return { stdout: Buffer.from("committed bytes"), failed: false };
      if (command === "moon") {
        writeFileSync(addon, "rebuilt bytes");
        return { stdout: "" };
      }
      if (command === "otool") {
        const rebuilt = args[1] === "addon.node";
        return { stdout: `${args[1]}:\n${rebuilt && stale ? "changed code" : "same code"}` };
      }
      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    });
    execaSync.mockImplementation((command: unknown) =>
      typeof command === "string" ? { stdout: root } : run,
    );
    expect(checkNativeArtifacts()).toBe(stale ? 1 : 0);
    expect(readFileSync(addon, "utf8")).toBe(stale ? "rebuilt bytes" : "local bytes before check");
  },
);
