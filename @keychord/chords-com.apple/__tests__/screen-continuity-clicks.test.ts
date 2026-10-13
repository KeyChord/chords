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
const geometry = vi.hoisted(() => ({
  getScreenBounds: vi.fn(),
  validateScreenBounds: vi.fn(),
}));
vi.mock("../src/js/utils/screenContinuity.node", () => ({ default: geometry }));

beforeEach(() => {
  geometry.getScreenBounds.mockReset().mockResolvedValue(JSON.stringify(bounds));
  geometry.validateScreenBounds.mockReset().mockResolvedValue(undefined);
  clickMock.mockResolvedValue(undefined);
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
  await vi.advanceTimersByTimeAsync(499);
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

test("a long press holds for the UIKit default duration and the next point is a normal tap", async () => {
  vi.useFakeTimers();
  const action = openScreenContinuityAddon().clickPoints(
    JSON.stringify({ bounds, points: [{ ...points[0], click: "long" }, points[1]] }),
  );
  await vi.runAllTimersAsync();
  await action;
  const expectedBounds = { x: -100, y: 200, width: 300, height: 600 };
  expect(click).toHaveBeenNthCalledWith(1, {
    windowId: 123,
    x: 150,
    y: 580,
    expectedBounds,
    pressDurationMs: 500,
  });
  expect(click).toHaveBeenNthCalledWith(2, { windowId: 123, x: 30, y: 300, expectedBounds });
});

test("private API errors reach the caller and prevent the rest of the sequence", async () => {
  clickMock.mockRejectedValue(new Error("CGEventSetWindowLocation is unavailable"));
  await expect(openScreenContinuityAddon().clickPoints(request)).rejects.toThrow(
    "CGEventSetWindowLocation",
  );
  expect(click).toHaveBeenCalledOnce();
});
