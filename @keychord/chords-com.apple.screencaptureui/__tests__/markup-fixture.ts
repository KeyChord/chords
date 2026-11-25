import { expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const screenshot = "com.apple.screencaptureui";
const preferences = "com.apple.screencapture";
export const markupSequences = { save: "fs", copy: "fc" };

export async function verifyScreenshotMarkup(
  testURL: string,
  action: keyof typeof markupSequences,
) {
  console.log(
    "guest macOS",
    Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
  );
  await withChordPackage(testURL, (app) =>
    withMacOSProbe(async (probe) => {
      const directory = await mkdtemp(join(tmpdir(), "chordtest-screenshot-"));
      const defaults = (action: string, ...args: string[]) =>
        runCommand(["/usr/bin/defaults", action, preferences, ...args]);
      const readDefault = async (key: string) =>
        (await defaults("read", key).catch(() => undefined))?.stdout.trim();
      const originalLocation = await readDefault("location");
      const originalThumbnail = await readDefault("show-thumbnail");
      const image = new Bun.Glob("*.{png,jpg,jpeg,heic,tiff}");
      const desktop = join(homedir(), "Desktop");
      const desktopImages = async () => {
        const images = await Array.fromAsync(image.scan(desktop));
        return images.filter((file) => /^(Screenshot|Screen Shot) /i.test(file));
      };
      const desktopBefore = new Set(await desktopImages());
      const newDesktopImages = async () =>
        (await desktopImages())
          .filter((file) => !desktopBefore.has(file))
          .map((file) => join(desktop, file));
      const savedImages = async () => {
        const paths = (await Array.fromAsync(image.scan(directory))).map((file) =>
          join(directory, file),
        );
        return [...paths, ...(await newDesktopImages())].filter((file) => Bun.file(file).size > 0);
      };
      const windows = () => probe.windows(screenshot, 7).catch(() => []);
      const windowWithButton = async (label: string) =>
        (await windows()).find((window) =>
          flattenAX([window]).some(
            (node) =>
              node.role === "AXButton" &&
              [node.description, node.title].some((text) => text?.toLowerCase() === label),
          ),
        );
      const markupWindow = () => windowWithButton("done");
      const waitForClosed = () =>
        waitFor(async () => ((await markupWindow()) ? undefined : true), 10_000);
      const closeMarkup = async () => {
        if (!(await markupWindow())) return;
        await probe.press(screenshot, "File", "Close");
        await waitForClosed();
      };
      const readyMenu = (menu: string, title: string) =>
        waitFor(async () => {
          const item = await probe.menu(screenshot, menu, title).catch(() => undefined);
          return item?.enabled || undefined;
        }, 10_000);
      const openMarkup = async () => {
        await probe.activate("com.apple.finder");
        expect(await markupWindow()).toBeUndefined();
        await probe.key(20, (1 << 20) | (1 << 17)); // Command-Shift-3
        const thumbnail = await waitFor(async () => {
          const window = await windowWithButton("markup");
          return window?.subrole === "AXSystemDialog" && window.position && window.size
            ? window
            : undefined;
        }, 8_000).catch(async (cause) => {
          throw new Error(
            "Screenshot UI did not appear: " +
              JSON.stringify({
                app: await probe.front(),
                windows: await windows(),
                visible: (await probe.screenWindows()).filter(({ owner }) =>
                  /screen.?capture|screenshot/i.test(owner),
                ),
              }),
            { cause },
          );
        });
        const [x, y] = thumbnail.position!;
        const [width, height] = thumbnail.size!;
        await probe.clickPoint(x + width / 2, y + height / 2);
        await waitFor(markupWindow, 12_000);
      };
      const clipboardHasImage = async () => {
        const { stdout } = await runCommand(["/usr/bin/osascript", "-e", "clipboard info"]);
        return /class PNGf|TIFF picture|JPEG picture/i.test(stdout);
      };
      try {
        await defaults("write", "location", "-string", directory);
        await defaults("write", "show-thumbnail", "-bool", "true");
        if (action === "save") {
          await openMarkup();
          expect(await savedImages()).toEqual([]);
          await readyMenu("File", "Save");
          await app.runChecked(markupSequences.save);
          await waitFor(async () => (await savedImages())[0], 12_000);
          console.log("Screenshot fs saved the image");
          await closeMarkup();
        } else {
          const clearClipboard = Bun.spawn(["/usr/bin/pbcopy"], { stdin: new Blob(["Chordtest"]) });
          expect(await clearClipboard.exited).toBe(0);
          expect(await clipboardHasImage()).toBe(false);
          await openMarkup();
          expect(await savedImages()).toEqual([]);
          await readyMenu("Edit", "Copy and Close");
          await app.runChecked(markupSequences.copy);
          await waitForClosed();
          await waitFor(async () => (await clipboardHasImage()) || undefined, 10_000);
          expect(await savedImages()).toEqual([]);
          console.log("Screenshot fc copied the image and closed the editor");
        }
        await probe.activate("com.apple.finder");
        await app.expectFailure(markupSequences.save, /no chord is configured for `fs`/);
      } finally {
        try {
          await closeMarkup();
        } finally {
          if (originalLocation === undefined) await defaults("delete", "location").catch(() => {});
          else await defaults("write", "location", "-string", originalLocation);
          if (originalThumbnail === undefined) {
            await defaults("delete", "show-thumbnail").catch(() => {});
          } else {
            await defaults(
              "write",
              "show-thumbnail",
              "-bool",
              originalThumbnail === "1" ? "true" : "false",
            );
          }
          for (const file of await newDesktopImages()) await rm(file, { force: true });
          await rm(directory, { recursive: true, force: true });
        }
      }
    }),
  );
}
