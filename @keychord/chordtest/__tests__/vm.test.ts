import { describe, expect, test } from "bun:test";
import { guestTestScript, shellQuote, vmOptions, vmRunArguments } from "../src/vm";
import { isVirtualMac, requireMacOSVM } from "../src/runtime";

describe("isolated macOS testing", () => {
  test("keeps VM input, audio, clipboard, and source files isolated", () => {
    const options = { ...vmOptions({}), workspace: "/Users/Test User/chords' repo" };
    const args = vmRunArguments(options);
    expect(args).toContain("--no-graphics");
    expect(args).toContain("--no-audio");
    expect(args).toContain("--no-clipboard");
    expect(args).toContain(`--dir=chords-sources:${options.workspace}:ro`);
  });

  test("only enables UI tests in the guest command", () => {
    const script = guestTestScript([]);
    expect(script).toContain("CHORD_TESTING_UI=1 bun test");
    expect(script).toContain("vp install --frozen-lockfile");
    expect(script).toContain("--exclude=node_modules");
    expect(script).toContain("@keychord/chordtest/__tests__");
    expect(script).toContain("@keychord/chords-tray/__tests__");
  });

  test("quotes paths without interpreting shell metacharacters", () => {
    const path = "packages/test's $(echo wrong)/__tests__";
    const quoted = shellQuote(path);
    const result = Bun.spawnSync(["/bin/sh", "-c", `printf '%s' ${quoted}`]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe(path);
    expect(guestTestScript([path])).toContain(quoted);
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
