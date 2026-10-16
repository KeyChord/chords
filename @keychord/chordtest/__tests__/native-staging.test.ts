import { expect, test } from "bun:test";
import { mkdtemp, mkdir, open, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stageNativeAddon } from "../src/native";

test("rebuilding an addon preserves images already opened by the running app", async () => {
  const root = await mkdtemp(join(tmpdir(), "chord-native-staging-"));
  const build = join(root, "build");
  const output = join(root, "output");
  await mkdir(build);
  const binary = join(build, "fixture.node");
  const runtime = join(build, "libNodeAPI.dylib");
  const accessibility = join(build, "libAXorcistRuntime.dylib");
  try {
    await Bun.write(binary, "original addon");
    await Bun.write(runtime, "original runtime");
    await Bun.write(accessibility, "original accessibility runtime");
    await stageNativeAddon(binary, output, "fixture");
    const oldAddon = await open(join(output, "fixture.node"));
    const oldRuntime = await open(join(output, "libNodeAPI.dylib"));
    const oldAccessibility = await open(join(output, "libAXorcistRuntime.dylib"));
    try {
      await Bun.write(binary, "rebuilt addon");
      await Bun.write(runtime, "rebuilt runtime");
      await Bun.write(accessibility, "rebuilt accessibility runtime");
      await stageNativeAddon(binary, output, "fixture");
      expect(await oldAddon.readFile("utf8")).toBe("original addon");
      expect(await oldRuntime.readFile("utf8")).toBe("original runtime");
      expect(await oldAccessibility.readFile("utf8")).toBe("original accessibility runtime");
      expect(await Bun.file(join(output, "libAXorcistRuntime.dylib")).text()).toBe(
        "rebuilt accessibility runtime",
      );
      expect(await Bun.file(join(output, "fixture.node")).text()).toBe("rebuilt addon");
      expect(await Bun.file(join(output, "libNodeAPI.dylib")).text()).toBe("rebuilt runtime");
      await unlink(runtime);
      await Bun.write(binary, "incomplete build");
      await expect(stageNativeAddon(binary, output, "fixture")).rejects.toThrow();
      expect(await Bun.file(join(output, "fixture.node")).text()).toBe("rebuilt addon");
      expect(await Bun.file(join(output, "libNodeAPI.dylib")).text()).toBe("rebuilt runtime");
    } finally {
      await oldAddon.close();
      await oldRuntime.close();
      await oldAccessibility.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
