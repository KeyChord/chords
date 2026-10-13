import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import buildVisibilityHandler from "../src/js/visibility";

let spawn: ReturnType<typeof spyOn<typeof Bun, "spawn">>;
beforeEach(() => {
  spawn = spyOn(Bun, "spawn");
});
afterEach(() => spawn.mockRestore());

test("menu bar visibility resolves after the system preference update succeeds", async () => {
  spawn.mockReturnValue({
    stderr: new Response("").body,
    exited: Promise.resolve(0),
  } as ReturnType<typeof Bun.spawn>);
  await expect(buildVisibilityHandler()()).resolves.toBeUndefined();
  expect(spawn.mock.calls[0][1]).toMatchObject({ timeout: 10_000 });
});

test("menu bar visibility reports Automation failures", async () => {
  spawn.mockReturnValue({
    stderr: new Response("Not authorized to send Apple events to System Events. (-1743)\n").body,
    exited: Promise.resolve(1),
  } as ReturnType<typeof Bun.spawn>);
  await expect(buildVisibilityHandler()()).rejects.toThrow("Not authorized to send Apple events");
});

test("menu bar visibility reports a terminated or timed-out subprocess", async () => {
  spawn.mockReturnValue({
    stderr: new Response("").body,
    exited: Promise.resolve(143),
    signalCode: "SIGTERM",
  } as ReturnType<typeof Bun.spawn>);
  await expect(buildVisibilityHandler()()).rejects.toThrow("terminated by SIGTERM");
});
