import { buildNative } from "../scripts/build-native";
import { expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// No UI or input APIs are used: only main-actor scheduling and JS completion.
// Two addons sharing NodeAPI disable NodeSwift's single-environment fallback.
test.skipIf(process.platform !== "darwin")(
  "multiple addons resolve and reject main-actor promises without losing their JS queues",
  async () => {
    const scratch = Bun.fileURLToPath(
      new URL("../node_modules/.cache/chord/native/actor-regression", import.meta.url),
    );
    const modules = ["ChordActorRegressionTray", "ChordActorRegressionMenu"];
    await mkdir(scratch, { recursive: true });
    // Reuse the real addon's bridge and compiler cache; avoid rebuilding
    // SwiftSyntax for fixtures. Register their N-API entrypoints directly.
    await buildNative(join(scratch, "TRAY"), "debug");
    const swiftpm = Bun.fileURLToPath(
      new URL("../node_modules/.cache/chord/native/swiftpm", import.meta.url),
    );
    const build = join(swiftpm, "debug");
    // The shipped helper, from the KeyChord/config release the package resolved.
    const helper = join(swiftpm, "checkouts/config/swift/ChordNodeSupport/MainActorPromise.swift");
    const binaries: string[] = [];
    for (const module of modules) {
      const sources = join(scratch, "Sources", module);
      await mkdir(sources, { recursive: true });
      await Bun.write(join(sources, "MainActorPromise.swift"), Bun.file(helper));
      await Bun.write(
        join(sources, "Probe.swift"),
        `import Foundation
import NodeAPI
enum ProbeError: Error { case expected }
@_cdecl("napi_register_module_v1")
public func register(env: OpaquePointer, exports: OpaquePointer) -> OpaquePointer? {
    NodeModuleRegistrar(env).register { ["probe": try NodeFunction { (fail: Bool) throws -> NodePromise in
    try mainActorPromise {
        try await Task.sleep(for: .milliseconds(1))
        if fail { throw ProbeError.expected }
    }
    }] }
}
`,
      );
      const binary = join(scratch, `${module}.node`);
      const compilation = Bun.spawn(
        [
          "swiftc",
          "-swift-version",
          "6",
          "-emit-library",
          "-module-name",
          module,
          "-I",
          join(build, "Modules"),
          "-Xcc",
          `-fmodule-map-file=${join(swiftpm, "checkouts/node-swift/Sources/CNodeAPI/module.modulemap")}`,
          "-Xcc",
          `-fmodule-map-file=${join(build, "CNodeAPISupport.build/module.modulemap")}`,
          "-L",
          build,
          "-lNodeAPI",
          "-Xlinker",
          "-rpath",
          "-Xlinker",
          build,
          join(sources, "MainActorPromise.swift"),
          join(sources, "Probe.swift"),
          "-o",
          binary,
        ],
        { stdout: "ignore", stderr: "pipe", timeout: 60_000 },
      );
      const [diagnostics, status] = await Promise.all([
        new Response(compilation.stderr).text(),
        compilation.exited,
      ]);
      expect({ status, diagnostics }).toEqual({ status: 0, diagnostics: "" });
      binaries.push(binary);
    }
    const script = join(scratch, "probe.ts");
    await Bun.write(
      script,
      `import { dlopen, ptr } from "bun:ffi";
const cf = dlopen("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation", {
    CFStringCreateWithCString: { args: ["ptr", "ptr", "u32"], returns: "ptr" },
    CFRunLoopRunInMode: { args: ["ptr", "f64", "bool"], returns: "i32" },
    CFRelease: { args: ["ptr"], returns: "void" }
});
const mode = cf.symbols.CFStringCreateWithCString(null, ptr(Buffer.from("kCFRunLoopDefaultMode\\0")), 0x08000100);
if (!mode) throw new Error("Could not create run loop mode");
const timer = setInterval(() => cf.symbols.CFRunLoopRunInMode(mode, 0.005, true), 1);
try {
    const addons = ${JSON.stringify(binaries)}.map(binary => {
        const module = { exports: {} as any };
        process.dlopen(module, binary);
        return module.exports;
    });
    for (let round = 0; round < 100; round++) {
        await Promise.all(addons.map(async addon => {
            await addon.probe(false);
            let rejected = false;
            try { await addon.probe(true); } catch { rejected = true; }
            if (!rejected) throw new Error("native error was not rejected");
        }));
    }
    console.log("400 main-actor completions passed");
} finally {
    clearInterval(timer);
    cf.symbols.CFRelease(mode);
    cf.close();
}
`,
    );
    const host = process.env.CHORD_NATIVE_TEST_HOST;
    const child = Bun.spawn(host ? [host, "bun", script] : [process.execPath, script], {
      stdout: "pipe",
      stderr: "pipe",
      timeout: 30_000,
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect({ code, stderr }).toEqual({ code: 0, stderr: "" });
    expect(stdout).toContain("400 main-actor completions passed");
  },
  300_000,
);
