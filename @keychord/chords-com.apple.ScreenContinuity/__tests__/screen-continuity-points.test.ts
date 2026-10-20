import { expect, test } from "bun:test";
import { clampDevicePoints } from "../src/js/utils/screen-continuity-points";

const bounds = { x: -100, y: 200, width: 300, height: 600 };

test("straight edges land two points inside the screen while interior coordinates stay unchanged", () => {
  expect(
    clampDevicePoints(
      [
        { x: -100, y: 500 },
        { x: 199, y: 500 },
        { x: 50, y: 200 },
        { x: 50, y: 799 },
        { x: -70, y: 380 },
        { x: 80, y: 620 },
      ],
      bounds,
    ),
  ).toEqual([
    { x: -98, y: 500 },
    { x: 198, y: 500 },
    { x: 50, y: 202 },
    { x: 50, y: 798 },
    { x: -70, y: 380 },
    { x: 80, y: 620 },
  ]);
});

test("corners use the same two-point inset and preserve action metadata", () => {
  const points = clampDevicePoints(
    [
      { x: -100, y: 200, click: "DRAG", hold: true },
      { x: 199, y: 200, click: "MOVE" },
      { x: -100, y: 799 },
      { x: 199, y: 799 },
    ],
    bounds,
  );
  expect(points).toEqual([
    { x: -98, y: 202, click: "DRAG", hold: true },
    { x: 198, y: 202, click: "MOVE" },
    { x: -98, y: 798 },
    { x: 198, y: 798 },
  ]);
});

test("the small edge inset stays constant through zoom and fits a tiny viewport", () => {
  expect(clampDevicePoints([{ x: 0, y: 0 }], { x: 0, y: 0, width: 600, height: 1200 })).toEqual([
    { x: 2, y: 2 },
  ]);
  expect(clampDevicePoints([{ x: -100, y: 200 }], { ...bounds, width: 1, height: 1 })).toEqual([
    { x: -99.5, y: 200.5 },
  ]);
});
