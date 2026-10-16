// Vite+ also calls this helper under Node from native build hooks.
import { copyFile, mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { build } from "node-swift";

export const hostTriple = `${process.arch === "arm64" ? "aarch64" : "x86_64"}-apple-darwin`;

export async function buildNativeAddon(options: {
  packageRoot: string;
  product: string;
  name: string;
  outputDirectory?: string;
  mode?: "debug" | "release";
}) {
  const { packageRoot, product, name, mode = "debug" } = options;
  const cacheDirectory = join(packageRoot, "node_modules", ".cache", "chord", "native");
  const outputDirectory = options.outputDirectory ?? join(cacheDirectory, "test-addon", name);
  const binary = await build(mode, {
    packagePath: packageRoot,
    buildPath: join(cacheDirectory, "swiftpm"),
    product,
    static: false,
    napi: 8,
    // Tests inspect SwiftPM's Modules/ and module maps when compiling queue probes.
    builder: { type: "swiftpm", settings: ["--build-system", "native"] },
  });
  return stageNativeAddon(binary, outputDirectory, name);
}

export async function stageNativeAddon(binary: string, outputDirectory: string, name: string) {
  await mkdir(outputDirectory, { recursive: true });
  const addon = join(outputDirectory, `${name}.node`);
  // Native images may still be mapped by a running Chord process. Replacing
  // files by rename preserves its old inodes; copying onto them can corrupt
  // executable pages while the process is using them.
  const staged = await mkdtemp(join(outputDirectory, ".stage-"));
  try {
    await copyFile(binary, join(staged, `${name}.node`));
    const runtimes = ["libNodeAPI.dylib"];
    const accessibilityRuntime = "libAXorcistRuntime.dylib";
    if (
      await stat(join(dirname(binary), accessibilityRuntime)).catch((error) => {
        if (error.code === "ENOENT") return undefined;
        throw error;
      })
    )
      runtimes.push(accessibilityRuntime);
    for (const runtime of runtimes) {
      await copyFile(join(dirname(binary), runtime), join(staged, runtime));
    }
    for (const runtime of runtimes) {
      await rename(join(staged, runtime), join(outputDirectory, runtime));
    }
    await rename(join(staged, `${name}.node`), addon);
  } finally {
    await rm(staged, { recursive: true, force: true });
  }
  return addon;
}

export function loadNativeAddon<T>(binary: string): T {
  const module = { exports: {} as T };
  process.dlopen(module, binary);
  return module.exports;
}
