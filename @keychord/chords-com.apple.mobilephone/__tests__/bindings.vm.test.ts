import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.mobilephone";

test("every Phone binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/mobilephone/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["g,", "vm"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Phone chords open settings and report unavailable calling controls",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await probe.activate(bundleId);
        const windows = async () => await probe.windows(bundleId, 7);
        // A signed-out guest can expose the native menu bar without a main window.
        await waitFor(async () => {
          const nodes = flattenAX(await windows().catch(() => []));
          const welcome = nodes.some((node) =>
            [node.title, node.description, node.value].includes("Welcome to Phone"),
          );
          if (welcome) {
            const next = nodes.find(
              ({ role, title, description, enabled }) =>
                role === "AXButton" && enabled && [title, description].includes("Continue"),
            );
            if (next?.position && next.size) {
              await probe.clickPoint(
                next.position[0] + next.size[0] / 2,
                next.position[1] + next.size[1] / 2,
              );
            }
            return;
          }
          return probe.menu(bundleId, "Phone", "Settings…").catch(() => undefined);
        }, 15_000);

        const menu = (...path: string[]) =>
          waitFor(() => probe.menu(bundleId, ...path).catch(() => undefined), 10_000);
        const settings = await menu("Phone", "Settings…");
        if (settings.enabled === false) {
          await app.expectFailure("g,", /Menu item "Settings…".*is disabled/);
        } else {
          const settingsVisible = async () =>
            (await windows()).some(
              (window) =>
                /Settings|General/.test(window.title ?? "") ||
                flattenAX([window]).some((node) =>
                  [node.title, node.description, node.value].includes("Blocked"),
                ),
            );
          expect(await settingsVisible()).toBe(false);
          await app.runChecked("g,");
          try {
            await waitFor(async () => ((await settingsVisible()) ? true : undefined), 10_000);
          } finally {
            await probe.key(13, 1 << 20);
            await waitFor(async () => ((await settingsVisible()) ? undefined : true));
          }
        }

        expect((await menu("Audio", "Mute")).enabled).toBe(false);
        await app.expectFailure("vm", /Menu item "Mute".*is disabled/);
      }),
    );
  },
  120_000,
);
