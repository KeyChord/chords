import { expect, test } from "bun:test";
import { chordPattern, type ChordPlaceholders } from "@keychord/chordtest/patterns";
import buildMonitorHandler from "../src/js/desktop-monitor";
import { displayOfWindow, targetDisplay } from "../src/js/desktop-monitor/layout";
import { parseMonitors, parseWindows } from "../src/js/desktop-monitor/linux";

const displays = parseMonitors(`Monitors: 3
 0: +DP-2 1280/320x1024/256-1280+0  DP-2
 1: +*DP-1 1920/480x1080/270+0+0  DP-1
 2: +HDMI-0 1280/320x800/200+200-800  HDMI-0
`);
const [left, primary, upper] = displays;

test("numbering starts at primary while directional selection follows the physical layout", () => {
  const pointer = { x: 300, y: 400 };
  expect(targetDisplay(displays, "1", pointer)).toBe(primary);
  expect(targetDisplay(displays, "2", pointer)).toBe(left);
  expect(targetDisplay(displays, "LEFT", pointer)).toBe(left);
  expect(targetDisplay(displays, "UP", pointer)).toBe(upper);
  expect(targetDisplay(displays, "PREVIOUS", pointer)).toBe(upper);
  expect(targetDisplay(displays, "NEXT", { x: 250, y: -300 })).toBe(primary);
  expect(() => targetDisplay(displays, "DOWN", pointer)).toThrow("No monitor to the DOWN");
});

test("assigns spanning windows by intersection and ignores windows from other desktops", () => {
  const output = `0x01  0 -800 0  1000 500 host Spanning
0x02  1   55 0   500 500 host Elsewhere
0x03 -1    5 0   250 250 host Sticky
`;
  const windows = parseWindows(output, 0);
  expect([...windows.keys()]).toEqual([1, 3]);
  expect(displayOfWindow(displays, windows.get(1)!)).toBe(left);
  expect(displayOfWindow(displays, windows.get(3)!)).toBe(primary);
});

test.each(["linux", "windows"])(
  "%s selects the portable handler for every monitor binding",
  async (platform) => {
    const definition = Bun.TOML.parse(
      await Bun.file(new URL(`../chords/${platform}.toml`, import.meta.url)).text(),
    ) as {
      on: Record<string, { file: string }>;
      placeholders: ChordPlaceholders;
      chords: Record<string, { "@input:monitor"?: [string] }>;
    };
    expect(definition.on.monitor.file).toBe("desktop-monitor.js");
    for (const [input, expected] of [
      [";m12", "12"],
      [";m[", "PREVIOUS"],
      [";m]", "NEXT"],
      [";ml", "LEFT"],
      [";mr", "RIGHT"],
      [";mt", "UP"],
      [";mb", "DOWN"],
    ]) {
      const matches = Object.entries(definition.chords).flatMap(([pattern, binding]) => {
        const match = chordPattern(pattern, definition.placeholders).exec(input);
        const args = binding["@input:monitor"];
        return match && args ? [args[0].replace(/\$(\d+)/g, (_, i) => match[Number(i)])] : [];
      });
      expect(matches).toEqual([expected]);
    }
  },
);

test("the handler rejects malformed targets before opening the desktop backend", async () => {
  await expect(buildMonitorHandler()("0")).rejects.toThrow(TypeError);
  await expect(buildMonitorHandler()("9007199254740992")).rejects.toThrow(TypeError);
});
