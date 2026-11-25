import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
} from "@keychord/chordtest";
import { activateMagnifier, bundle, zoom } from "./magnifier";
import { cameraName, startCamera } from "./live-camera";

test.skipIf(!macOSUITestsEnabled)(
  "Magnifier zoom chords adjust the live camera preview",
  async () => {
    await withMacOSProbe(async (probe) => {
      await startCamera(probe);
      await withChordPackage(import.meta.url, async (app) => {
        await activateMagnifier(probe);
        const device = await probe.menu(bundle, "Camera", cameraName);
        expect(device.enabled).toBe(true);
        const automatic = await probe.menu(bundle, "Camera", "Automatic Camera Selection");
        if (automatic.enabled && automatic.mark) {
          await probe.press(bundle, "Camera", "Automatic Camera Selection");
        }
        const clickMenuItem = async (node: AXNode) => {
          if (!node.position || !node.size?.every((length) => length > 0)) return false;
          const [x, y] = node.position;
          const [width, height] = node.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
          return true;
        };
        expect(await probe.front()).toBe(bundle);
        if (await clickMenuItem(await probe.menuElement(bundle, "Camera"))) {
          await Bun.sleep(450);
        }
        if (!(await clickMenuItem(await probe.menuElement(bundle, "Camera", cameraName)))) {
          await probe.press(bundle, "Camera", cameraName);
        }
        await waitFor(async () => (await probe.menu(bundle, "Camera", cameraName)).mark);

        // SwiftUI exposes the live zoom thumb's position even without an AXValue.
        const scale = async () => {
          const controls = flattenAX(await probe.windows(bundle, 12));
          if (controls.some((node) => node.value === "No cameras found")) return;
          const slider = controls.find(
            (node) => node.role === "AXSlider" && node.id === "ZOOM_SLIDER",
          );
          const thumb = slider?.children?.find((node) => node.role === "AXValueIndicator");
          if (slider?.position && thumb?.position) return thumb.position[0] - slider.position[0];
        };
        const initial = await waitFor(scale, 12_000);
        const change = async (
          sequence: keyof typeof zoom,
          before: number,
          matches: (value: number) => boolean,
        ) => {
          expect((await probe.menu(bundle, "View", zoom[sequence])).enabled).toBe(true);
          await app.runChecked(sequence);
          const after = await waitFor(async () => {
            const value = await scale();
            return value !== undefined && matches(value) ? value : undefined;
          }, 12_000);
          console.log("Magnifier live zoom", sequence, before, after);
          return after;
        };

        const larger = await change("zi", initial, (value) => value > initial + 0.5);
        const smaller = await change("zo", larger, (value) => value < larger - 0.5);
        const aboveFit = await change("zi", smaller, (value) => value > smaller + 0.5);
        await change("za", aboveFit, (value) => Math.abs(value - initial) < 0.5);
      });
    });
  },
  180_000,
);
