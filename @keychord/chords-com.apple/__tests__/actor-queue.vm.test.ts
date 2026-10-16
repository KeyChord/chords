import { expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { prepareMacOSPackage } from "@keychord/chordtest";

let preparation: ReturnType<typeof prepareMacOSPackage> | undefined;

// Read-only: this also runs safely against a local embedded host. It never
// invokes a tap, changes settings, launches an app, or sends Safari JavaScript.
for (const bridge of ["Mirroring", "Safari"] as const) {
  test.skipIf(process.platform !== "darwin" || !process.env.CHORD_NATIVE_TEST_HOST)(
    `${bridge} promises retain their JS queues across multiple native addons`,
    async () => {
      const root = Bun.fileURLToPath(new URL("..", import.meta.url));
      const cache = join(root, "node_modules/.cache/chord/native");
      // Rebuild once so compiler probes never import a stale Swift module after
      // an Xcode/toolchain update. The helper pins the cache layout we inspect.
      await (preparation ??= prepareMacOSPackage(root));
      const build = join(cache, "swiftpm/debug");
      const scratch = join(cache, `${bridge.toLowerCase()}-queue-regression`);
      await mkdir(scratch, { recursive: true });
      const source = join(scratch, "Probe.swift");
      await Bun.write(
        source,
        `import Foundation
import NodeAPI
enum ProbeError: Error { case expected }
@_cdecl("napi_register_module_v1")
public func register(env: OpaquePointer, exports: OpaquePointer) -> OpaquePointer? {
    NodeModuleRegistrar(env).register { ["probe": try NodeFunction { (mode: String) throws -> NodePromise in
        ${bridge === "Mirroring" ? 'if mode == "value" { return try mainActorPromise { "geometry-ok" } }' : ""}
        return try mainActorPromise {
            ${bridge === "Safari" ? "try await Task.sleep(for: .milliseconds(1))" : ""}
            if mode == "error" { throw ProbeError.expected }
        }
    }] }
}
`,
      );
      const binary = join(scratch, `${bridge}QueueProbe.node`);
      const compilation = Bun.spawn(
        [
          "swiftc",
          "-swift-version",
          "6",
          "-emit-library",
          "-module-name",
          `${bridge}QueueProbe`,
          "-I",
          join(build, "Modules"),
          "-Xcc",
          `-fmodule-map-file=${join(dirname(build), "checkouts/node-swift/Sources/CNodeAPI/module.modulemap")}`,
          "-Xcc",
          `-fmodule-map-file=${join(build, "CNodeAPISupport.build/module.modulemap")}`,
          "-L",
          build,
          "-lNodeAPI",
          "-Xlinker",
          "-rpath",
          "-Xlinker",
          build,
          // The shipped helper, from the KeyChord/config release the package resolved.
          join(dirname(build), "checkouts/config/swift/ChordNodeSupport/MainActorPromise.swift"),
          source,
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
      // Load the sibling AXorcist addons too: all must use the shared runtime,
      // otherwise ObjC reports duplicate classes before any UI action is invoked.
      const addons = [
        ...new Bun.Glob("chords-*/js/native/**/*.node").scanSync({ cwd: dirname(root) }),
      ].map((path) => join(dirname(root), path));
      expect(addons.length).toBeGreaterThanOrEqual(2);
      const script = join(scratch, "probe.ts");
      await Bun.write(
        script,
        `import assert from "node:assert/strict";
const paths = ${JSON.stringify(addons)};
const production = paths.map(path => require(path));
const geometry = production.find(addon => typeof addon.getScreenBounds === "function");
assert.ok(geometry);
const probe = require(${JSON.stringify(binary)});
for (let round = 0; round < 100; round++) {
    assert.equal(await probe.probe("value"), ${bridge === "Mirroring" ? '"geometry-ok"' : "undefined"});
    assert.equal(await probe.probe("void"), undefined);
    await assert.rejects(probe.probe("error"));
    await assert.rejects(geometry.validateScreenBounds(JSON.stringify({x:0,y:0,width:0,height:0,windowId:0})), /Invalid mirrored/);
    try {
        const bounds = JSON.parse(await geometry.getScreenBounds());
        assert.ok(bounds.width > 0 && bounds.height > 0);
    } catch (error) {
        assert.match(String(error), /Mirroring|Accessibility|mirrored iPhone/);
    }
}
console.log("500 main-actor completions passed");
`,
      );
      const child = Bun.spawn([process.env.CHORD_NATIVE_TEST_HOST!, "bun", script], {
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
      expect(stdout).toContain("500 main-actor completions passed");
    },
    300_000,
  );
}
