import { describe, expect, test } from "bun:test";
import {
  defaultVMImage,
  discoverMacOSTests,
  guestTestScript,
  shellQuote,
  vmOptions,
  vmRunArguments,
  workspaceRoot,
} from "../src/vm";
import { isVirtualMac, requireMacOSVM } from "../src/runtime";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("isolated macOS testing", () => {
  test("full-suite discovery refuses to silently omit a new package", async () => {
    const root = await mkdtemp(join(tmpdir(), "chordtest-discovery-"));
    try {
      await Bun.write(
        join(root, "@keychord/new-package/package.json"),
        '{"name":"@keychord/new-package"}',
      );
      expect(() => discoverMacOSTests([], root)).toThrow("Missing macOS VM test entry points");
      await Bun.write(join(root, "@keychord/new-package/__tests__/macos.vm.test.ts"), "// fixture");
      expect(discoverMacOSTests([], root)).toEqual([
        "@keychord/new-package/__tests__/macos.vm.test.ts",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  test("keeps VM input, audio, clipboard, and source files isolated", () => {
    const options = { ...vmOptions({}), workspace: "/Users/Test User/chords' repo" };
    const args = vmRunArguments(options);
    expect(args).toContain("--no-graphics");
    expect(args).toContain("--no-audio");
    expect(args).toContain("--no-clipboard");
    expect(args).toContain(`--dir=chords-sources:${options.workspace}:ro`);
    expect(args).toContain(`--dir=chords-config:${join(options.workspace, "..", "config")}:ro`);
  });

  test("only enables UI tests in the guest command", () => {
    const script = guestTestScript([]);
    expect(script).toContain("export CHORD_TESTING_UI=1");
    expect(script).toContain("bun test --timeout 300000");
    expect(script).toContain(
      "/bin/bash '/Volumes/My Shared Files/chords-sources/@keychord/chordtest/src/guest-workspace.sh'",
    );
    expect(script).toContain("@keychord/chordtest/__tests__");
    expect(script).toContain("@keychord/chords-menu/__tests__");
    expect(script).toContain("CHORD_NATIVE_TEST_HOST");
    expect(script).toContain("CHORD_SKIP_NATIVE=1 vp run build");
  });

  test("quotes paths without interpreting shell metacharacters", () => {
    const path = "packages/test's $(echo wrong)/__tests__";
    const quoted = shellQuote(path);
    const result = Bun.spawnSync(["/bin/sh", "-c", `printf '%s' ${quoted}`]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe(path);
    expect(() => guestTestScript([path])).toThrow("No macOS VM tests");
  });

  test("selected suites build only their packages and workspace dependencies", () => {
    const script = guestTestScript(["@keychord/chords-dock", "@keychord/chords-menu"]);
    expect(script).toContain("--filter='./@keychord/chords-dock...'");
    expect(script).toContain("--filter='./@keychord/chords-menu...'");
    expect(script).not.toContain("vp run build");
    expect(script).not.toContain("chords-terminal");
  });

  test("pins the guest image and requires one VM entry point per chord package", async () => {
    expect(vmOptions({}).image).toBe(defaultVMImage);
    expect(defaultVMImage).toMatch(/@sha256:[a-f0-9]{64}$/);
    const tests = discoverMacOSTests();
    for (const manifest of new Bun.Glob("@keychord/*/package.json").scanSync({
      cwd: workspaceRoot,
    })) {
      expect(tests).toContain(`${manifest.slice(0, -13)}/__tests__/macos.vm.test.ts`);
    }
    expect(discoverMacOSTests(["@keychord/chords-click"])).toEqual([
      "@keychord/chords-click/__tests__/macos.vm.test.ts",
    ]);
  });

  test("rejects paths outside the shared workspace", () => {
    expect(() => guestTestScript(["/tmp/__tests__"])).toThrow("relative");
    expect(() => guestTestScript(["packages/../../__tests__"])).toThrow("relative");
    expect(() => vmOptions({ CHORD_TESTING_VM_NAME: "--other-vm" })).toThrow("Invalid");
  });

  test("recognizes virtual hardware and refuses host hardware", () => {
    expect(isVirtualMac("VirtualMac2,1\n")).toBe(true);
    expect(isVirtualMac("Mac16,5")).toBe(false);
    expect(isVirtualMac("MacBookPro18,3")).toBe(false);
    expect(isVirtualMac("VirtualMac;anything")).toBe(false);
    if (process.env.CHORD_TESTING_UI !== "1") expect(requireMacOSVM).toThrow();
  });
});
