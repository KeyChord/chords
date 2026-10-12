import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { click } from "chord";
import { openScreenContinuityAddon } from "../src/js/utils/screen-continuity-native";

const bounds = { x: -100, y: 200, width: 300, height: 600, windowId: 123 };
const points = [
  { x: 50, y: 780 },
  { x: -70, y: 500 },
];
const request = JSON.stringify({ bounds, points });
const clickMock = vi.mocked(click);
const geometry = {
  getScreenBounds: vi.fn(),
  validateScreenBounds: vi.fn(),
};

beforeEach(() => {
  geometry.getScreenBounds.mockReset().mockResolvedValue(JSON.stringify(bounds));
  geometry.validateScreenBounds.mockReset().mockResolvedValue(undefined);
  clickMock.mockResolvedValue(undefined);
  vi.spyOn(process, "dlopen").mockImplementation((module, filename) => {
    expect(filename).toMatch(
      /\/chords-com\.apple\/target\/[^/]+\/screen-continuity\/screen-continuity\.node$/,
    );
    module.exports = geometry;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("passes window-local coordinates and the actual window ID to Chord's shared click helper", async () => {
  vi.useFakeTimers();
  const order: string[] = [];
  geometry.validateScreenBounds.mockImplementation(async () => {
    order.push("validate");
  });
  clickMock.mockImplementation(async () => {
    order.push("click");
  });
  const addon = openScreenContinuityAddon();
  expect(await addon.getScreenBounds()).toBe(JSON.stringify(bounds));
  const result = addon.clickPoints(request);
  await vi.advanceTimersByTimeAsync(0);
  expect(click).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(199);
  expect(click).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1);
  await result;
  const expectedBounds = { x: -100, y: 200, width: 300, height: 600 };
  expect(click).toHaveBeenNthCalledWith(1, { windowId: 123, x: 150, y: 580, expectedBounds });
  expect(click).toHaveBeenNthCalledWith(2, { windowId: 123, x: 30, y: 300, expectedBounds });
  expect(geometry.validateScreenBounds).toHaveBeenCalledTimes(2);
  expect(geometry.validateScreenBounds).toHaveBeenCalledWith(JSON.stringify(bounds));
  expect(order).toEqual(["validate", "click", "validate", "click"]);
});

test("a disconnected or changed screen stops before sending any input", async () => {
  geometry.validateScreenBounds.mockRejectedValue(new Error("Mirroring disconnected"));
  await expect(openScreenContinuityAddon().clickPoints(request)).rejects.toThrow("disconnected");
  expect(click).not.toHaveBeenCalled();
});

test("private API errors reach the caller and prevent the rest of the sequence", async () => {
  clickMock.mockRejectedValue(new Error("CGEventSetWindowLocation is unavailable"));
  await expect(openScreenContinuityAddon().clickPoints(request)).rejects.toThrow(
    "CGEventSetWindowLocation",
  );
  expect(click).toHaveBeenCalledOnce();
});
