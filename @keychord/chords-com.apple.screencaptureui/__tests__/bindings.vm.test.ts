import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const screenshot = "com.apple.screencaptureui";
const preferences = "com.apple.screencapture";
const cases = { save: "fs", copy: "fc" };

test("every Screenshot binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/screencaptureui/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.values(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Screenshot Markup saves the image and can copy it to the clipboard while closing",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const directory = await mkdtemp(join(tmpdir(), "chordtest-screenshot-"));
        const defaults = (action: string, ...args: string[]) =>
          runCommand(["/usr/bin/defaults", action, preferences, ...args]);
        const readDefault = async (key: string) =>
          (await defaults("read", key).catch(() => undefined))?.stdout.trim();
        const originalLocation = await readDefault("location");
        const originalThumbnail = await readDefault("show-thumbnail");
        const windows = () => probe.windows(screenshot, 7).catch(() => []);
        const markupWindow = async () =>
          (await windows()).find((window) =>
            flattenAX([window]).some(
              (node) =>
                node.role === "AXButton" &&
                [node.description, node.title].some((label) => label?.toLowerCase() === "markup"),
            ),
          );
        const waitForClosed = () =>
          waitFor(async () => ((await markupWindow()) ? undefined : true), 10_000);
        const openMarkup = async () => {
          await probe.activate("com.apple.finder");
          const before = JSON.stringify(await windows());
          await probe.key(20, (1 << 17) | (1 << 20)); // Shift–Command–3
          const thumbnail = await waitFor(async () => {
            const current = await windows();
            if (JSON.stringify(current) === before) return;
            const visible = current.filter(
              (window) => window.role === "AXWindow" && window.position && window.size,
            );
            if (visible.length === 1) return visible[0];
          }, 4_000);
          if (!(await markupWindow())) {
            const [x, y] = thumbnail.position!;
            const [width, height] = thumbnail.size!;
            await probe.clickPoint(x + width / 2, y + height / 2);
          }
          await waitFor(markupWindow, 12_000);
          await waitFor(async () => ((await probe.front()) === screenshot ? true : undefined));
        };
        const clipboardHasImage = async () => {
          const { stdout } = await runCommand(["/usr/bin/osascript", "-e", "clipboard info"]);
          return /class PNGf|TIFF picture|JPEG picture/i.test(stdout);
        };
        try {
          await defaults("write", "location", "-string", directory);
          await defaults("write", "show-thumbnail", "-bool", "true");
          await openMarkup();
          const image = new Bun.Glob("*.{png,jpg,jpeg,heic,tiff}");
          const savedImage = async () => {
            for await (const entry of image.scan(directory)) {
              if (Bun.file(join(directory, entry)).size > 0) return entry;
            }
          };
          expect(await savedImage()).toBeUndefined();
          await app.runChecked(cases.save);
          await waitFor(savedImage, 12_000);
          if (await markupWindow()) {
            await probe.key(53);
            await waitForClosed();
          }

          const clearClipboard = Bun.spawn(["/usr/bin/pbcopy"], { stdin: new Blob(["Chordtest"]) });
          expect(await clearClipboard.exited).toBe(0);
          expect(await clipboardHasImage()).toBe(false);
          await openMarkup();
          await app.runChecked(cases.copy);
          await waitForClosed();
          await waitFor(async () => ((await clipboardHasImage()) ? true : undefined), 10_000);
        } finally {
          if (await markupWindow()) await probe.key(53);
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
          await rm(directory, { recursive: true, force: true });
        }
      }),
    );
  },
  150_000,
);
