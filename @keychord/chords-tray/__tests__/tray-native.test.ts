import { loadNativeAddon } from "@keychord/chordtest/native";
import { macOSUITestsEnabled, withMacOSRunLoop } from "@keychord/chordtest/runtime";
import { beforeAll, describe, expect, test } from "bun:test";
import { buildNative } from "../scripts/build-native";

type TrayAddon = { runTrayAction(type: string, value: string, action: string): Promise<void> };

// These tests load the real Swift addon. Validation happens before accessibility/UI actions.
describe.skipIf(process.platform !== "darwin")("Swift tray addon in Bun", () => {
  let addon: TrayAddon;
  beforeAll(async () => {
    const directory = Bun.fileURLToPath(
      new URL("../node_modules/.cache/chord-native/test-addon", import.meta.url),
    );
    const binary = await buildNative(directory, "debug");
    addon = loadNativeAddon<TrayAddon>(binary);
  }, 300_000);

  const invalidActions: [string, string, string, string][] = [
    ["UNKNOWN", "", "", "unknown tray action"],
    ["", "", "", "unknown tray action"],
    ["ITEM", "nope", "left", "invalid tray index"],
    ["ITEM", "0.5", "left", "invalid tray index"],
    ["ITEM", "9223372036854775808", "left", "invalid tray index"],
    ["ITEM", "-9223372036854775808", "left", "invalid tray index"],
    ["ITEM", "0", "middle", "invalid tray click type"],
    ["CONTROL_CENTER", "WIFI", "", "invalid Control Center action"],
    ["CONTROL_CENTER", "", "INCREASE", "invalid Control Center action"],
    ["CONTROL_CENTER", "DISPLAY", "MISSING", "invalid Control Center action"],
    ["CONTROL_CENTER", "SOUND", "DARK_MODE", "invalid Control Center action"],
    ["CONTROL_CENTER", "SOUND", "NIGHT_SHIFT", "invalid Control Center action"],
    ["CONTROL_CENTER", "SOUND", "TRUE_TONE", "invalid Control Center action"],
    ["CONTROL_CENTER", "SOUND", "SETTINGS", "invalid Control Center action"],
  ];
  for (const [type, value, action, error] of invalidActions) {
    test(`rejects ${JSON.stringify([type, value, action])}`, async () => {
      await expect(addon.runTrayAction(type, value, action)).rejects.toThrow(error);
    });
  }

  test.skipIf(!macOSUITestsEnabled)(
    "opens and switches panels, adjusts sliders, toggles display options, and opens Settings",
    () =>
      withMacOSRunLoop(async () => {
        const probeSource = Bun.fileURLToPath(
          new URL("./ControlCenterProbe.swift", import.meta.url),
        );
        const probeBinary = Bun.fileURLToPath(
          new URL("../node_modules/.cache/chord-native/control-center-probe", import.meta.url),
        );
        const compilation = Bun.spawn(["swiftc", probeSource, "-o", probeBinary], {
          stderr: "inherit",
        });
        expect(await compilation.exited).toBe(0);

        type Control = {
          role: string;
          identifier?: string;
          description?: string;
          value?: number;
          minimum?: number;
          maximum?: number;
          enabled?: boolean;
        };
        async function probe(...args: string[]) {
          const process = Bun.spawn([probeBinary, ...args], { stdout: "pipe", stderr: "inherit" });
          const output = await new Response(process.stdout).text();
          expect(await process.exited).toBe(0);
          return output ? (JSON.parse(output) as Control[]) : [];
        }
        async function maybeControl(identifier: string) {
          return (await probe()).find((element) => element.identifier === identifier);
        }
        async function control(identifier: string) {
          const match = await maybeControl(identifier);
          expect(match).toBeDefined();
          return match!;
        }
        const run = (section = "", action = "") =>
          addon.runTrayAction("CONTROL_CENTER", section, action);
        try {
          await run();
          const hasDisplay = !!(await maybeControl("controlcenter-display"));
          if (hasDisplay) {
            await run("DISPLAY");
            await run("DISPLAY", "CLICK");
            await control("display-setting-dark-mode");
          } else {
            await expect(run("DISPLAY")).rejects.toThrow("could not find DISPLAY");
            console.info("DISPLAY is unavailable on this virtual Mac");
          }
          await run("SOUND", "CLICK");
          expect((await control("controlcenter-volume")).role).toBe("AXStaticText");
          await run();
          expect((await control("controlcenter-volume")).role).toBe("AXButton");

          for (const [section, identifier] of [
            ["DISPLAY", "controlcenter-display-brightness-slider"],
            ["SOUND", "controlcenter-volume-slider"],
          ]) {
            if (section === "DISPLAY" && !hasDisplay) continue;
            await run(section);
            const original = await maybeControl(identifier);
            if (!original) {
              await expect(run(section, "INCREASE")).rejects.toThrow("slider");
              await expect(run(section, "DECREASE")).rejects.toThrow("slider");
              console.info(`${section} slider is unavailable on this virtual Mac`);
              continue;
            }
            if (original.enabled === false) {
              await expect(run(section, "INCREASE")).rejects.toThrow("disabled");
              await expect(run(section, "DECREASE")).rejects.toThrow("disabled");
              continue;
            }
            // Move towards the center first so reversing the adjustment restores the original
            // value even when the initial value is at an endpoint. AXValue is often read-only.
            const first = original.value! > 0.5 ? "DECREASE" : "INCREASE";
            const reverse = first === "INCREASE" ? "DECREASE" : "INCREASE";
            try {
              await run(section, first);
              const changed = (await control(identifier)).value!;
              if (first === "INCREASE") expect(changed).toBeGreaterThan(original.value!);
              else expect(changed).toBeLessThan(original.value!);
              await run(section, reverse);
              expect((await control(identifier)).value!).toBeCloseTo(original.value!, 4);
            } finally {
              const current = (await control(identifier)).value!;
              if (Math.abs(current - original.value!) > 0.0001) await run(section, reverse);
            }
          }

          if (hasDisplay) {
            await run("DISPLAY");
            for (const [action, identifier] of [
              ["DARK_MODE", "display-setting-dark-mode"],
              ["NIGHT_SHIFT", "display-setting-night-shift"],
              ["TRUE_TONE", "display-setting-true-tone"],
            ]) {
              const toggle = await maybeControl(identifier);
              if (!toggle) {
                await expect(run("DISPLAY", action)).rejects.toThrow(`could not find ${action}`);
                console.info(`${action} is unavailable on this virtual Mac`);
                continue;
              }
              if (toggle.enabled === false) {
                await expect(run("DISPLAY", action)).rejects.toThrow("disabled");
                continue;
              }
              const original = toggle.value;
              try {
                await run("DISPLAY", action);
                expect((await control(identifier)).value).not.toBe(original);
              } finally {
                if ((await control(identifier)).value !== original) await run("DISPLAY", action);
              }
              expect((await control(identifier)).value).toBe(original);
            }
            await run("DISPLAY", "SETTINGS");
            const deadline = Date.now() + 5_000;
            let frontmostID = "";
            do {
              const frontmost = Bun.spawn([probeBinary, "frontmost"], {
                stdout: "pipe",
                stderr: "inherit",
              });
              frontmostID = (await new Response(frontmost.stdout).text()).trim();
              expect(await frontmost.exited).toBe(0);
              if (frontmostID === "com.apple.systempreferences") break;
              await Bun.sleep(100);
            } while (Date.now() < deadline);
            expect(frontmostID).toBe("com.apple.systempreferences");
          }
        } finally {
          await probe("close");
        }
      }),
    60_000,
  );
});
