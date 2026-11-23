import { test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bindings = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, { "@input:menu"?: [string, string[]] }> };
const paths = Object.entries(bindings.chords).flatMap(([key, chord]) => {
  const path = chord["@input:menu"]?.[1];
  return path?.[0] === "Window" ? [[key.replace("<>", ";b"), path] as const] : [];
});

test.skipIf(!macOSUITestsEnabled)(
  "Window menu chords reach every built-in tiling and window action",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const scratch = await mkdtemp(join(tmpdir(), "chordtest-window-menu-"));
        const editor = "com.apple.TextEdit";
        const failures: string[] = [];
        const document = (number: number) => join(scratch, `Chordtest ${number}.txt`);
        const frame = async () =>
          JSON.stringify(
            (await probe.windows(editor)).map((node) => [node.title, node.position, node.size]),
          );
        try {
          for (let index = 1; index <= 4; index++) await Bun.write(document(index), "Chordtest\n");
          for (const [sequence, path] of paths) {
            try {
              for (let index = 1; index <= 4; index++)
                await probe.activate(editor, document(index));
              await waitFor(async () =>
                (await probe.windows(editor)).length === 4 ? true : undefined,
              );
              if (sequence === ";bwfl" || sequence === ";bwfr") {
                const inSplitView = await probe
                  .menu(editor, "Window", "Full Screen Tile", "Move Window to Desktop")
                  .catch(() => undefined);
                if (inSplitView?.enabled) {
                  await probe.press(editor, "Window", "Full Screen Tile", "Move Window to Desktop");
                }
                await waitFor(() => probe.menu(editor, ...path).catch(() => undefined), 12_000);
              }
              const menu = await probe.menu(editor, ...path);
              if (sequence === ";bwo" && !menu.enabled)
                await probe.press(editor, "Window", "Move & Resize", "Right");
              if (sequence === ";bwx" && !menu.enabled) {
                await app.expectFailure(sequence, /Menu item "Quarters" .* is disabled/);
                console.log("Window menu ;bwx reports unavailable four-way tiling");
                continue;
              }
              const finder = "com.apple.finder";
              if (sequence === ";bwaf") {
                await probe.activate(finder, scratch);
                await probe.activate(editor, document(4));
                await waitFor(async () => {
                  const order = await probe.windowOrder();
                  const finderIndex = order.indexOf(finder);
                  return finderIndex >= 0 && order.lastIndexOf(editor) > finderIndex
                    ? true
                    : undefined;
                });
              }
              const before = await frame();
              const space =
                sequence === ";bwfl" || sequence === ";bwfr"
                  ? (await probe.desktops()).activeSpace
                  : undefined;
              await app.run(sequence);
              await app.flush();
              if (sequence === ";bw") {
                await waitFor(async () =>
                  (await probe.menu(editor, "Window")).selected ? true : undefined,
                );
              } else if (sequence === ";bwaf") {
                await waitFor(async () => {
                  const order = await probe.windowOrder();
                  return order.slice(0, 4).every((app) => app === editor) && order.includes(finder)
                    ? true
                    : undefined;
                });
              } else {
                await waitFor(
                  async () =>
                    (await frame()) !== before ||
                    (space !== undefined && (await probe.desktops()).activeSpace !== space)
                      ? true
                      : undefined,
                  10_000,
                );
              }
              console.log(`Window menu ${sequence} passed`);
            } catch (error) {
              failures.push(`${sequence} ${path.join(" > ")}: ${error}`);
            } finally {
              await probe.key(53);
              // Close the saved fixtures and prepare fresh windows for the next chord.
              await probe.key(13, (1 << 20) | (1 << 19));
            }
          }
        } finally {
          await rm(scratch, { recursive: true, force: true });
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  240_000,
);
