import { expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { prepareMacOSPackage } from "@keychord/chordtest";

// Read-only: this also runs safely against a local embedded host. It never
// invokes a tap, changes settings, launches an app, or sends Safari JavaScript.
test.skipIf(process.platform !== "darwin" || !process.env.CHORD_NATIVE_TEST_HOST)(
  "Mirroring promises retain their JS queues across multiple native addons",
  async () => {
    const root = Bun.fileURLToPath(new URL("..", import.meta.url));
    const cache = join(root, "node_modules/.cache/chord/native");
    const candidates = [
      join(cache, "aarch64-apple-darwin/screenContinuity/build/arm64-apple-macosx/release/release"),
      join(cache, "swiftpm/debug"),
    ];
    const findBuild = async () => {
      for (const directory of candidates) {
        if (await Bun.file(join(directory, "Modules/NodeAPI.swiftmodule")).exists())
          return directory;
      }
    };
    let build = await findBuild();
    if (!build) {
      await prepareMacOSPackage(root);
      build = await findBuild();
    }
    if (!build) throw new Error("Native NodeAPI compiler cache is unavailable");
    const scratch = join(cache, "mirroring-queue-regression");
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
        try mainActorPromise {
            if mode == "error" { throw ProbeError.expected }
            return mode == "void" ? nil : "geometry-ok"
        }
    }] }
}
`,
    );
    const binary = join(scratch, "MirroringQueueProbe.node");
    const compilation = Bun.spawn(
      [
        "swiftc",
        "-swift-version",
        "6",
        "-emit-library",
        "-module-name",
        "MirroringQueueProbe",
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
        join(root, "src/swift/screen-continuity/MainActorPromise.swift"),
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
    const addons = [...new Bun.Glob("js/native/**/*.node").scanSync({ cwd: root })].map((path) =>
      join(root, path),
    );
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
    assert.equal(await probe.probe("value"), "geometry-ok");
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
