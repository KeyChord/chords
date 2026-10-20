import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
export const bridgeSource = join(root, "native", "livesplit-bridge.m");
export const bridgeLibrary = join(
  root,
  "target",
  "aarch64-apple-darwin",
  "livesplit-bridge",
  "livesplit-bridge.dylib",
);

// LiveSplit One ships as an arm64-only executable, so the injected bridge matches it.
export async function buildBridge(output = bridgeLibrary): Promise<string> {
  mkdirSync(dirname(output), { recursive: true });
  const child = Bun.spawn(
    [
      "/usr/bin/xcrun",
      "clang",
      "-dynamiclib",
      // The default install name is the output path, which would make the build location-dependent.
      "-install_name",
      "@rpath/livesplit-bridge.dylib",
      "-arch",
      "arm64",
      // WKWebView.callAsyncJavaScript requires macOS 11.
      "-mmacosx-version-min=11.0",
      "-fobjc-arc",
      "-fmodules",
      "-O2",
      "-Wall",
      "-Wextra",
      "-Werror",
      "-framework",
      "AppKit",
      "-framework",
      "WebKit",
      "-o",
      output,
      bridgeSource,
    ],
    { stdin: "ignore", stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await child.exited;
  if (exitCode !== 0)
    throw new Error(`clang failed to build the LiveSplit bridge (exit ${exitCode}).`);
  return output;
}

if (import.meta.main) await buildBridge(process.argv[2] ? resolve(process.argv[2]) : undefined);
