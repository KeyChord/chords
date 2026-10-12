/** Supply Chord's per-module resolver while loading handler sources directly in Bun. */
export function installChordRuntime(options: {
  filter: RegExp;
  packageRoot: string;
  nativeDirectory: string;
}) {
  Bun.plugin({
    name: "chord-testing-runtime",
    setup(builder) {
      builder.onLoad({ filter: options.filter }, async ({ path }) => ({
        contents: `import.meta.chord = {
          resolveNative: (name) => ${JSON.stringify(options.nativeDirectory)} + '/' + name + '.node',
          resolvePackageFile: (name) => ${JSON.stringify(options.packageRoot)} + '/' + name
        };\n${await Bun.file(path).text()}`,
        loader: "ts",
      }));
    },
  });
}

export function isVirtualMac(model: string): boolean {
  return /^VirtualMac\d+,\d+$/.test(model.trim());
}

/** Environment flags alone never authorize real desktop interaction. */
export function requireMacOSVM() {
  if (process.platform !== "darwin") throw new Error("macOS UI tests require a macOS guest");
  const result = Bun.spawnSync(["/usr/sbin/sysctl", "-n", "hw.model"]);
  if (result.exitCode !== 0 || !isVirtualMac(result.stdout.toString())) {
    throw new Error(
      "Refusing to run UI tests on the host Mac. Run vp run test:macos to use the Tart VM.",
    );
  }
}

export const macOSUITestsEnabled = process.env.CHORD_TESTING_UI === "1";

/** Standalone Bun does not service the Cocoa run loop like the Chord host does. */
export async function withMacOSRunLoop<T>(operation: () => Promise<T>): Promise<T> {
  requireMacOSVM();
  const { dlopen, ptr } = await import("bun:ffi");
  const cf = dlopen("/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation", {
    CFStringCreateWithCString: { args: ["ptr", "ptr", "u32"], returns: "ptr" },
    CFRunLoopRunInMode: { args: ["ptr", "f64", "bool"], returns: "i32" },
    CFRelease: { args: ["ptr"], returns: "void" },
  });
  const mode = cf.symbols.CFStringCreateWithCString(
    null,
    ptr(Buffer.from("kCFRunLoopDefaultMode\0")),
    0x08000100,
  );
  if (!mode) {
    cf.close();
    throw new Error("Could not create the main run loop mode");
  }
  const timer = setInterval(() => cf.symbols.CFRunLoopRunInMode(mode, 0.005, true), 5);
  try {
    return await operation();
  } finally {
    clearInterval(timer);
    cf.symbols.CFRelease(mode);
    cf.close();
  }
}
