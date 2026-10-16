/**
 * Test helpers that `bun:test` lacks, matching the vitest behavior chord package tests use.
 *
 * Fake timers use @sinonjs/fake-timers, the implementation behind vitest's: the async variants
 * flush pending promise callbacks between timers, which Bun's built-in fake timers cannot.
 */
import FakeTimers from "@sinonjs/fake-timers";
import type { Mock } from "bun:test";

const realSetTimeout = globalThis.setTimeout;
let clock: FakeTimers.Clock | undefined;

/**
 * Fakes every timer API, `Date` and `performance` except `nextTick` and `queueMicrotask`, like
 * vitest's default, so promise callbacks still run. `config` is passed to the clock's install.
 */
export function useFakeTimers(config: FakeTimers.Config = {}) {
  clock?.uninstall();
  const timers = FakeTimers.withGlobal(globalThis);
  clock = timers.install({
    toFake: Object.keys(timers.timers).filter(
      (method) => method !== "nextTick" && method !== "queueMicrotask",
    ) as FakeTimers.Config["toFake"],
    ...config,
  });
}

export function useRealTimers() {
  clock?.uninstall();
  clock = undefined;
}

function installedClock() {
  if (!clock) throw new Error("Call useFakeTimers() before advancing fake timers");
  return clock;
}

export async function advanceTimersByTimeAsync(ms: number) {
  await installedClock().tickAsync(ms);
}

export async function runAllTimersAsync() {
  await installedClock().runAllAsync();
}

/**
 * Retries `callback` until it stops throwing, like vitest's `vi.waitFor`. With fake timers
 * installed, each retry also advances them by `interval`.
 */
export async function waitFor<T>(
  callback: () => T | Promise<T>,
  options: number | { timeout?: number; interval?: number } = {},
): Promise<T> {
  const { timeout = 1000, interval = 50 } =
    typeof options === "number" ? { timeout: options } : options;
  const deadline = performance.now() + timeout;
  for (;;) {
    try {
      return await callback();
    } catch (error) {
      if (performance.now() >= deadline) throw error;
      if (clock) clock.tick(interval);
      else await new Promise((resolve) => realSetTimeout(resolve, interval));
    }
  }
}

const stubbedGlobals = new Map<string, PropertyDescriptor | undefined>();

/** Replaces a global until `unstubAllGlobals()`. Spy on `Bun` methods instead of replacing it. */
export function stubGlobal(name: string, value: unknown) {
  if (!stubbedGlobals.has(name)) {
    stubbedGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  }
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export function unstubAllGlobals() {
  for (const [name, descriptor] of stubbedGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as Record<string, unknown>)[name];
  }
  stubbedGlobals.clear();
}

/** Types an imported mock (such as a `chord` export) as a Bun mock. */
export function mocked<T extends (...args: any[]) => any>(fn: T): Mock<T> {
  return fn as unknown as Mock<T>;
}
