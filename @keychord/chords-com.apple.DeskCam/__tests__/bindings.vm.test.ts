import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const deskView = "com.apple.DeskCam";
const settingCases = {
  vs: "Always Show Setup",
};
const zoomCases = {
  "z=": ["Zoom In", "Zoom Out", 1],
  "z-": ["Zoom Out", "Zoom In", -1],
} as const;

test("every Desk View binding has a behavior case", async () => {
  const { chords } = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/DeskCam/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(["gs", "vf", ...Object.keys(settingCases), ...Object.keys(zoomCases)].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Desk View changes its setup and view controls or reports that they are disabled",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        // Skip the native introduction on the disposable guest.
        await runCommand([
          "/usr/bin/defaults",
          "write",
          deskView,
          "DCAUserDefaultsDidConfirmIntro",
          "-bool",
          "true",
        ]);
        await probe.activate(deskView);
        const view = (title: string) => probe.menu(deskView, "View", title);
        const disabled = /Menu item .* is disabled/;
        try {
          await waitFor(async () => {
            const intro = flattenAX(await probe.windows(deskView, 9)).find(
              ({ role, title, id, enabled }) =>
                role === "AXButton" && title === "Continue" && id === "Primary Button" && enabled,
            );
            if (intro?.position && intro.size) {
              await probe.clickPoint(
                intro.position[0] + intro.size[0] / 2,
                intro.position[1] + intro.size[1] / 2,
              );
              return;
            }
            const window = await probe.window(deskView);
            if (window.role === "AXWindow")
              return probe.menu(deskView, "View").catch(() => undefined);
          }, 15_000);
          for (const [sequence, title] of Object.entries(settingCases)) {
            const before = await view(title);
            if (before.enabled === false) {
              await app.expectFailure(sequence, disabled);
              continue;
            }
            await app.runChecked(sequence);
            await waitFor(async () =>
              (await view(title)).mark !== before.mark ? true : undefined,
            );
            await app.runChecked(sequence);
            await waitFor(async () =>
              (await view(title)).mark === before.mark ? true : undefined,
            );
          }

          const zoomValue = async () => {
            const controls = flattenAX(await probe.windows(deskView, 6));
            const slider = controls.find((node) => node.role === "AXSlider");
            return typeof slider?.value === "number" ? slider.value : undefined;
          };
          for (const [sequence, [title, restore, direction]] of Object.entries(zoomCases)) {
            if ((await view(title)).enabled === false) {
              await app.expectFailure(sequence, disabled);
              continue;
            }
            const before = await waitFor(zoomValue);
            await app.runChecked(sequence);
            await waitFor(async () => {
              const value = await zoomValue();
              return value !== undefined && Math.sign(value - before) === direction
                ? true
                : undefined;
            });
            await probe.press(deskView, "View", restore);
            await waitFor(async () => ((await zoomValue()) === before ? true : undefined));
          }

          const enter = () => view("Enter Full Screen").catch(() => undefined);
          const exit = () => view("Exit Full Screen").catch(() => undefined);
          await waitFor(async () => (await enter())?.enabled || undefined);
          const beforeFullscreen = await probe.window(deskView);
          expect(beforeFullscreen.size).toBeDefined();
          try {
            await app.runChecked("vf");
            await waitFor(async () => {
              if ((await exit())?.enabled) return true;
              const { size } = await probe.window(deskView);
              if (
                size &&
                beforeFullscreen.size &&
                size.every((length, index) => length > beforeFullscreen.size![index])
              )
                return true;
            }, 12_000).catch(async (cause) => {
              throw new Error(
                "Desk View did not enter fullscreen: " +
                  JSON.stringify({
                    before: beforeFullscreen,
                    after: await probe.window(deskView),
                    enter: await enter(),
                    exit: await exit(),
                  }),
                { cause },
              );
            });
            const fullscreenSize = (await probe.window(deskView)).size;
            const exitWasEnabled = (await exit())?.enabled === true;
            await app.runChecked("vf");
            await waitFor(async () => {
              if (exitWasEnabled && (await enter())?.enabled && !(await exit())?.enabled)
                return true;
              const { size } = await probe.window(deskView);
              if (
                size &&
                fullscreenSize &&
                size.some((length, index) => length < fullscreenSize[index])
              )
                return true;
            }, 12_000).catch(async (cause) => {
              throw new Error(
                "Desk View did not leave fullscreen: " +
                  JSON.stringify({
                    fullscreenSize,
                    after: await probe.window(deskView),
                    enter: await enter(),
                    exit: await exit(),
                  }),
                { cause },
              );
            });
          } finally {
            if ((await exit())?.enabled) await probe.press(deskView, "View", "Exit Full Screen");
          }

          if ((await view("Start Desk View")).enabled === false) {
            await app.expectFailure("gs", disabled);
          } else {
            await app.runChecked("gs");
            await waitFor(() => view("Return to Setup").catch(() => undefined), 12_000);
            await probe.press(deskView, "View", "Return to Setup");
            await waitFor(() => view("Start Desk View").catch(() => undefined), 12_000);
          }
        } finally {
          if (await probe.running(deskView)) {
            await runCommand(["/usr/bin/killall", "Desk View"]);
            await waitFor(async () => ((await probe.running(deskView)) ? undefined : true));
          }
        }
      }),
    );
  },
  140_000,
);
