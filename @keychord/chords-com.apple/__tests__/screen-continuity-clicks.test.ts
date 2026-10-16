import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  advanceTimersByTimeAsync,
  mocked,
  runAllTimersAsync,
  useFakeTimers,
  useRealTimers,
} from "@keychord/chordtest/test";
import { click, mouse } from "chord";
import { openScreenContinuityAddon } from "../src/js/utils/screen-continuity-native";

const bounds = {
  x: -92,
  y: 238,
  width: 284,
  height: 554,
  windowId: 123,
  windowBounds: { x: -100, y: 200, width: 300, height: 600 },
};
const points = [
  { x: 50, y: 780 },
  { x: -70, y: 500 },
];
const request = JSON.stringify({ bounds, points });
const clickMock = mocked(click);
const geometry = {
  getScreenBounds: mock(),
  validateScreenBounds: mock(),
};
mock.module("../src/js/utils/screenContinuity.node", () => ({ default: geometry }));

beforeEach(() => {
  geometry.getScreenBounds.mockReset().mockResolvedValue(JSON.stringify(bounds));
  geometry.validateScreenBounds.mockReset().mockResolvedValue(undefined);
  clickMock.mockResolvedValue(undefined);
  mocked(mouse).mockResolvedValue(undefined);
});

afterEach(() => {
  useRealTimers();
});

test("passes window-local coordinates and the actual window ID to Chord's shared click helper", async () => {
  useFakeTimers();
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
  await advanceTimersByTimeAsync(0);
  expect(click).toHaveBeenCalledOnce();
  await advanceTimersByTimeAsync(499);
  expect(click).toHaveBeenCalledOnce();
  await advanceTimersByTimeAsync(1);
  await result;
  const expectedBounds = { x: -100, y: 200, width: 300, height: 600 };
  expect(click).toHaveBeenNthCalledWith(1, {
    windowId: 123,
    x: 150,
    y: 580,
    expectedBounds,
    moveCursor: true,
  });
  expect(click).toHaveBeenNthCalledWith(2, {
    windowId: 123,
    x: 30,
    y: 300,
    expectedBounds,
    moveCursor: true,
  });
  expect(geometry.validateScreenBounds).toHaveBeenCalledTimes(2);
  expect(geometry.validateScreenBounds).toHaveBeenCalledWith(JSON.stringify(bounds));
  expect(order).toEqual(["validate", "click", "validate", "click"]);
});

test("a disconnected or changed screen stops before sending any input", async () => {
  geometry.validateScreenBounds.mockRejectedValue(new Error("Mirroring disconnected"));
  await expect(openScreenContinuityAddon().clickPoints(request)).rejects.toThrow("disconnected");
  expect(click).not.toHaveBeenCalled();
});

test("edge taps retain their small inset and window-local routing", async () => {
  useFakeTimers();
  const action = openScreenContinuityAddon().clickPoints(
    JSON.stringify({
      bounds,
      points: [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width - 1, y: bounds.y + bounds.height - 1 },
      ],
    }),
  );
  await runAllTimersAsync();
  await action;
  expect(click).toHaveBeenNthCalledWith(1, {
    windowId: 123,
    x: 10,
    y: 40,
    expectedBounds: bounds.windowBounds,
    moveCursor: true,
  });
  expect(click).toHaveBeenNthCalledWith(2, {
    windowId: 123,
    x: 290,
    y: 590,
    expectedBounds: bounds.windowBounds,
    moveCursor: true,
  });
});

test("hover reaches raw device boundaries without tap insets", async () => {
  useFakeTimers();
  const action = openScreenContinuityAddon().clickPoints(
    JSON.stringify({
      bounds,
      hover: true,
      points: [
        { x: bounds.x, y: bounds.y, click: "MOVE" },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height, click: "MOVE" },
      ],
    }),
  );
  await runAllTimersAsync();
  await action;
  expect(click).not.toHaveBeenCalled();
  expect(mouse).toHaveBeenNthCalledWith(2, {
    action: "move",
    windowId: 123,
    x: 8,
    y: 38,
    expectedBounds: bounds.windowBounds,
  });
  expect(mouse).toHaveBeenNthCalledWith(3, {
    action: "move",
    windowId: 123,
    x: 292,
    y: 592,
    expectedBounds: bounds.windowBounds,
  });
});

test("hover only moves the pointer and releases an earlier held drag first", async () => {
  useFakeTimers();
  const action = openScreenContinuityAddon().clickPoints(
    JSON.stringify({ bounds, points, hover: true }),
  );
  await runAllTimersAsync();
  await action;
  expect(click).not.toHaveBeenCalled();
  expect(mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual([
    "up",
    "move",
    "move",
    "up",
  ]);
  expect(mouse).toHaveBeenNthCalledWith(2, {
    action: "move",
    windowId: 123,
    x: 150,
    y: 580,
    expectedBounds: bounds.windowBounds,
  });
  expect(mouse).toHaveBeenNthCalledWith(3, {
    action: "move",
    windowId: 123,
    x: 30,
    y: 300,
    expectedBounds: bounds.windowBounds,
  });
  expect(geometry.validateScreenBounds).toHaveBeenCalledTimes(2);
});

test("a long press holds for the UIKit default duration and the next point is a normal tap", async () => {
  useFakeTimers();
  const action = openScreenContinuityAddon().clickPoints(
    JSON.stringify({ bounds, points: [{ ...points[0], click: "LONG" }, points[1]] }),
  );
  await runAllTimersAsync();
  await action;
  const expectedBounds = { x: -100, y: 200, width: 300, height: 600 };
  expect(click).toHaveBeenNthCalledWith(1, {
    windowId: 123,
    x: 150,
    y: 580,
    expectedBounds,
    moveCursor: true,
    pressDurationMs: 500,
  });
  expect(click).toHaveBeenNthCalledWith(2, {
    windowId: 123,
    x: 30,
    y: 300,
    expectedBounds,
    moveCursor: true,
  });
});

test("private API errors reach the caller and prevent the rest of the sequence", async () => {
  clickMock.mockRejectedValue(new Error("CGEventSetWindowLocation is unavailable"));
  await expect(openScreenContinuityAddon().clickPoints(request)).rejects.toThrow(
    "CGEventSetWindowLocation",
  );
  expect(click).toHaveBeenCalledOnce();
});

test("tap drags reuse native mouse down/movement/release with connection checks", async () => {
  useFakeTimers();
  const action = openScreenContinuityAddon().clickPoints(
    JSON.stringify({
      bounds,
      points: [
        { ...points[0], click: "DRAG" },
        { ...points[1], click: "DRAG" },
      ],
    }),
  );
  await runAllTimersAsync();
  await action;
  expect(click).not.toHaveBeenCalled();
  expect(mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual([
    "down",
    "move",
    "up",
  ]);
  expect(geometry.validateScreenBounds).toHaveBeenCalledTimes(2);
});

test("a disconnected tap screen still releases a drag before rejecting", async () => {
  useFakeTimers();
  geometry.validateScreenBounds
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("disconnected"));
  const action = openScreenContinuityAddon().clickPoints(
    JSON.stringify({
      bounds,
      points: [
        { ...points[0], click: "DRAG" },
        { ...points[1], click: "DRAG", hold: true },
      ],
    }),
  );
  // Bun's `expect(promise).rejects` blocks until the promise settles; capture the error instead.
  const rejected = action.then(
    () => undefined,
    (error: unknown) => error,
  );
  await runAllTimersAsync();
  expect(String(await rejected)).toContain("disconnected");
  expect(mocked(mouse).mock.calls.map(([options]) => options.action)).toEqual(["down", "up"]);
});
