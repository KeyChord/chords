import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.FaceTime";

test("every FaceTime binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/FaceTime/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["g,", "nc", "vt", "vm"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "FaceTime chords open settings and report unavailable calling controls",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        console.log(
          "guest macOS",
          Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
        );
        await probe.activate(bundleId);
        const windows = async () => await probe.windows(bundleId, 7);
        const firstWindows = await waitFor(async () => {
          const current = await windows().catch(() => []);
          if (current.length) return current;
        }, 15_000);
        if (
          flattenAX(firstWindows).some((node) =>
            [node.title, node.description, node.value].includes("Welcome to FaceTime"),
          )
        ) {
          await probe.pressControl(bundleId, "AXButton", "Continue");
          await waitFor(async () =>
            flattenAX(await windows()).some((node) =>
              [node.title, node.description, node.value].includes("Welcome to FaceTime"),
            )
              ? undefined
              : true,
          );
        }

        const menu = (...path: string[]) =>
          waitFor(() => probe.menu(bundleId, ...path).catch(() => undefined), 10_000);
        const settings = await menu("FaceTime", "Settings…");
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

        const newCall = await menu("File", "New FaceTime");
        if (newCall.enabled === false) {
          await app.expectFailure("nc", /Menu item "New FaceTime".*is disabled/);
        } else {
          const composeVisible = async () =>
            flattenAX(await windows()).some(
              (node) =>
                node.role === "AXTextField" &&
                [node.title, node.description].some((label) =>
                  /name|number|email/i.test(label ?? ""),
                ),
            ) &&
            flattenAX(await windows()).some(
              (node) =>
                node.role === "AXButton" && [node.title, node.description].includes("Create Link"),
            );
          expect(await composeVisible()).toBe(false);
          await app.runChecked("nc");
          try {
            await waitFor(async () => ((await composeVisible()) ? true : undefined), 10_000);
          } finally {
            await probe.key(53);
            await waitFor(async () => ((await composeVisible()) ? undefined : true));
          }
        }

        expect((await menu("Audio", "Mute")).enabled).toBe(false);
        await app.expectFailure("vm", /Menu item "Mute".*is disabled/);
        expect((await menu("Video", "Always on Top")).enabled).toBe(false);
        await app.expectFailure("vt", /Menu item "Always on Top".*is disabled/);
      }),
    );
  },
  120_000,
);
