import { loadNativeAddon } from "@keychord/chordtest/native";
import { waitFor } from "@keychord/chordtest/macos";
import { macOSUITestsEnabled, withMacOSRunLoop } from "@keychord/chordtest/runtime";
import { beforeAll, describe, expect, test } from "bun:test";
import { buildNative } from "../scripts/build-native";

type TrayAddon = {
  runTrayAction(type: string, value: string, action: string): Promise<void>;
  runMenuBarAction(
    app: string | undefined,
    scope: string,
    index: string,
    steps: string,
    click: string,
  ): Promise<void>;
};

// These tests load the real Swift addon. Validation happens before accessibility/UI actions.
describe.skipIf(process.platform !== "darwin")("Swift tray addon in Bun", () => {
  let addon: TrayAddon;
  beforeAll(async () => {
    const directory = Bun.fileURLToPath(
      new URL("../node_modules/.cache/chord/native/test-addon", import.meta.url),
    );
    const binary = await buildNative(directory, "debug");
    addon = loadNativeAddon<TrayAddon>(binary);
  }, 300_000);

  const invalidActions: [string, string, string, string][] = [
    ["UNKNOWN", "", "", "unknown tray action"],
    ["", "", "", "unknown tray action"],
    ["ITEM", "nope", "LEFT", "invalid tray index"],
    ["ITEM", "0.5", "LEFT", "invalid tray index"],
    ["ITEM", "9223372036854775808", "LEFT", "invalid tray index"],
    ["ITEM", "-9223372036854775808", "LEFT", "invalid tray index"],
    ["ITEM", "0", "middle", "invalid tray click type"],
    ["HOVER", "nope", "", "invalid tray index"],
    ["HOVER", "0.5", "", "invalid tray index"],
    ["HOVER", "-9223372036854775808", "", "invalid tray index"],
    ["HOVER", "0", "LEFT", "invalid HOVER tray action"],
    ["NOTCH", "0", "", "invalid NOTCH tray action"],
    ["NOTCH", "", "LEFT", "invalid NOTCH tray action"],
    ["BATTERY", "TOGGLE", "", "invalid BATTERY tray action"],
    ["DATE_TIME", "TOGGLE", "", "invalid DATE_TIME tray action"],
    ["BATTERY", "", "CLICK", "invalid BATTERY tray action"],
    ["WIFI", "OFF", "", "invalid WIFI tray action"],
    ["WIFI", "TOGGLE", "CLICK", "invalid WIFI tray action"],
    ["CONTROL_CENTER", "BLUETOOTH", "", "invalid Control Center action"],
    ["CONTROL_CENTER", "", "INCREASE", "invalid Control Center action"],
    ["CONTROL_CENTER", "DISPLAY", "MISSING", "invalid Control Center action"],
    ["CONTROL_CENTER", "DISPLAY", "TOGGLE", "invalid Control Center action"],
    ["CONTROL_CENTER", "WIFI", "INCREASE", "invalid Control Center action"],
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

  for (const [scope, index, steps, click] of [
    ["unknown", "0", "", ""],
    ["all", "0", "", ""],
    ["TRAY", "nope", "", ""],
    ["MENU", "0.5", "", ""],
    ["TRAY", "-9223372036854775808", "", ""],
    ["TRAY", "9223372036854775808", "", ""],
    ["TRAY", "0", "x", ""],
    ["TRAY", "0", "", "middle"],
  ]) {
    test(`rejects menu bar selection ${JSON.stringify([scope, index, steps, click])}`, async () => {
      await expect(addon.runMenuBarAction(undefined, scope, index, steps, click)).rejects.toThrow(
        "invalid menu bar selection",
      );
    });
  }

  test.skipIf(!macOSUITestsEnabled)(
    "hover moves the pointer between tray icons without opening a panel",
    () =>
      withMacOSRunLoop(async () => {
        const probeBinary = Bun.fileURLToPath(
          new URL("../node_modules/.cache/chord/native/hover-probe", import.meta.url),
        );
        const compilation = Bun.spawn(
          [
            "swiftc",
            Bun.fileURLToPath(new URL("./ControlCenterProbe.swift", import.meta.url)),
            "-o",
            probeBinary,
          ],
          { stderr: "inherit" },
        );
        expect(await compilation.exited).toBe(0);
        type Entry = {
          role?: string;
          title?: string;
          x?: number;
          y?: number;
          frame?: { x: number; y: number; width: number; height: number };
        };
        async function probe(...args: string[]): Promise<Entry[]> {
          const child = Bun.spawn([probeBinary, ...args], { stdout: "pipe", stderr: "inherit" });
          const output = await new Response(child.stdout).text();
          expect(await child.exited).toBe(0);
          return output ? JSON.parse(output) : [];
        }
        const items = (await probe("menu-bar")).filter(
          (item) =>
            item.role === "AXMenuBarItem" && item.frame && item.frame.y >= 0 && item.frame.y < 30,
        );
        const frames = [
          ...new Map(items.map((item) => [item.frame!.x, item.frame!])).values(),
        ].sort((a, b) => b.x - a.x);
        expect(frames.length).toBeGreaterThanOrEqual(2);
        const windows = async () =>
          [await probe(), await probe("windows", "com.apple.notificationcenterui")].map((entries) =>
            entries.filter((entry) => entry.role === "AXWindow").map((entry) => entry.title),
          );
        const before = await windows();
        for (const [offset, frame] of frames.slice(0, 2).entries()) {
          await addon.runTrayAction("HOVER", String(-offset - 1), "");
          const [cursor] = await probe("cursor");
          expect(cursor.x!).toBeCloseTo(frame.x + frame.width / 2, 0);
          expect(cursor.y!).toBeGreaterThanOrEqual(frame.y);
          expect(cursor.y!).toBeLessThan(frame.y + frame.height);
          expect(await windows()).toEqual(before);
        }
      }),
    60_000,
  );

  test.skipIf(!macOSUITestsEnabled)(
    "opens named system tray items and toggles Wi-Fi when available",
    () =>
      withMacOSRunLoop(async () => {
        const probeSource = Bun.fileURLToPath(
          new URL("./ControlCenterProbe.swift", import.meta.url),
        );
        const probeBinary = Bun.fileURLToPath(
          new URL("../node_modules/.cache/chord/native/system-tray-probe", import.meta.url),
        );
        const compilation = Bun.spawn(["swiftc", probeSource, "-o", probeBinary], {
          stderr: "inherit",
        });
        expect(await compilation.exited).toBe(0);
        type Control = {
          role: string;
          identifier?: string;
          title?: string;
          value?: number;
          enabled?: boolean;
        };
        async function probe(...args: string[]): Promise<Control[]> {
          const child = Bun.spawn([probeBinary, ...args], { stdout: "pipe", stderr: "inherit" });
          const output = await new Response(child.stdout).text();
          expect(await child.exited).toBe(0);
          return output ? JSON.parse(output) : [];
        }
        const run = (type: string, value = "") => addon.runTrayAction(type, value, "");
        const items = await probe("menu-bar");
        try {
          if (items.some((item) => item.identifier === "com.apple.menuextra.battery")) {
            await run("BATTERY");
            await waitFor(async () =>
              (await probe()).find((element) => element.role === "AXWindow"),
            );
            await probe("close");
          } else {
            await expect(run("BATTERY")).rejects.toThrow("BATTERY menu bar item");
          }

          // Desktop widgets keep their own AXWindows even when Notification Center is closed.
          const desktopWindows = (await probe("windows", "com.apple.notificationcenterui"))
            .filter((element) => element.role === "AXWindow")
            .map((element) => element.title);
          await run("DATE_TIME");
          const notificationWindow = await waitFor(async () =>
            (await probe("windows", "com.apple.notificationcenterui")).find(
              (element) => element.role === "AXWindow" && !desktopWindows.includes(element.title),
            ),
          );
          await run("DATE_TIME");
          await waitFor(async () =>
            (await probe("windows", "com.apple.notificationcenterui")).some(
              (element) =>
                element.role === "AXWindow" && element.title === notificationWindow.title,
            )
              ? undefined
              : true,
          );

          // Virtual Macs may expose no Wi-Fi hardware or tile. Check that absence is reported.
          await addon.runTrayAction("CONTROL_CENTER", "", "");
          const hasWifi = (await probe()).some(
            (element) => element.identifier === "controlcenter-wifi",
          );
          if (!hasWifi) {
            await expect(run("WIFI")).rejects.toThrow("could not find WIFI");
            await expect(run("WIFI", "TOGGLE")).rejects.toThrow("could not find WIFI");
            return;
          }
          await run("WIFI");
          const before = await probe();
          expect(before.some((element) => element.role === "AXWindow")).toBe(true);
          const toggle = before.find((element) =>
            ["AXCheckBox", "AXSwitch"].includes(element.role),
          );
          if (!toggle) {
            await expect(run("WIFI", "TOGGLE")).rejects.toThrow("Wi-Fi power toggle");
          } else if (toggle.enabled === false) {
            await expect(run("WIFI", "TOGGLE")).rejects.toThrow("disabled");
          } else {
            const readToggle = async () =>
              (await probe()).find(
                (element) =>
                  element.identifier === toggle.identifier && element.role === toggle.role,
              )!;
            try {
              await run("WIFI", "TOGGLE");
              await waitFor(async () =>
                (await readToggle()).value !== toggle.value ? true : undefined,
              );
              expect((await readToggle()).value).not.toBe(toggle.value);
            } finally {
              if ((await readToggle()).value !== toggle.value) await run("WIFI", "TOGGLE");
            }
            expect((await readToggle()).value).toBe(toggle.value);
          }
        } catch (error) {
          console.info("System tray accessibility evidence", {
            items: items.filter((element) => element.role === "AXMenuBarItem"),
            panel: await probe(),
            notifications: await probe("windows", "com.apple.notificationcenterui"),
          });
          throw error;
        } finally {
          await probe("close");
        }
      }),
    60_000,
  );

  test.skipIf(!macOSUITestsEnabled)(
    "opens and switches panels, adjusts sliders, toggles display options, and opens Settings",
    () =>
      withMacOSRunLoop(async () => {
        const probeSource = Bun.fileURLToPath(
          new URL("./ControlCenterProbe.swift", import.meta.url),
        );
        const probeBinary = Bun.fileURLToPath(
          new URL("../node_modules/.cache/chord/native/control-center-probe", import.meta.url),
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
