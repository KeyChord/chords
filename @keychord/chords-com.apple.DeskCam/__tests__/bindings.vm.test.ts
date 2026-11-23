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
  va: "Use Auto Zoom During Setup",
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
          await waitFor(() => probe.menu(deskView, "View").catch(() => undefined), 15_000);
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

          const fullscreen = () => view("Enter Full Screen");
          if ((await fullscreen()).enabled === false) {
            await app.expectFailure("vf", disabled);
          } else {
            await app.runChecked("vf");
            await waitFor(() => view("Exit Full Screen").catch(() => undefined), 12_000);
            await app.runChecked("vf");
            await waitFor(() => fullscreen().catch(() => undefined), 12_000);
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
