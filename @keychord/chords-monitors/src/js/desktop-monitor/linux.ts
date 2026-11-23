import { center, displayOfWindow, targetDisplay, type Display, type Frame } from "./layout";

async function x11(program: string, ...args: string[]): Promise<string> {
  const executable = Bun.which(program);
  if (!executable) throw new Error(`Monitor Chords requires ${program} on Linux`);
  const child = Bun.spawn([executable, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    timeout: 3_000,
    killSignal: "SIGKILL",
    env: { ...process.env, LC_ALL: "C" },
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(`${program} failed: ${stderr.trim() || exitCode}`);
  return stdout;
}

export function parseMonitors(output: string): Display[] {
  return output.split("\n").flatMap((line) => {
    const match = /^\s*\d+:\s+(\S+)\s+(\d+)\/\d+x(\d+)\/\d+([+-]\d+)([+-]\d+)(?:\s|$)/.exec(line);
    if (!match) return [];
    const [, flags, width, height, x, y] = match;
    return [{ primary: flags.includes("*"), x: +x, y: +y, width: +width, height: +height }];
  });
}

export function parseWindows(output: string, desktop: number): Map<number, Frame> {
  const windows = new Map<number, Frame>();
  for (const line of output.trim().split("\n")) {
    const [id, desk, x, y, width, height] = line.trim().split(/\s+/);
    if (!/^0x[\da-f]+$/i.test(id) || (+desk !== desktop && +desk !== -1)) continue;
    const frame = { x: +x, y: +y, width: +width, height: +height };
    if (Object.values(frame).every(Number.isFinite) && frame.width > 0 && frame.height > 0) {
      windows.set(Number(id), frame);
    }
  }
  return windows;
}

export async function focusLinux(target: string): Promise<void> {
  if (process.env.WAYLAND_DISPLAY || !process.env.DISPLAY) {
    throw new Error("Monitor Chords requires a Linux X11 session");
  }
  const [monitors, location, root, windowList] = await Promise.all([
    x11("xrandr", "--listactivemonitors"),
    x11("xdotool", "getmouselocation", "--shell"),
    x11("xprop", "-root", "_NET_CURRENT_DESKTOP", "_NET_CLIENT_LIST_STACKING"),
    x11("wmctrl", "-lG"),
  ]);
  const displays = parseMonitors(monitors);
  const x = Number(/^X=(-?\d+)$/m.exec(location)?.[1]);
  const y = Number(/^Y=(-?\d+)$/m.exec(location)?.[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Could not read the pointer");

  const desktop = Number(/^_NET_CURRENT_DESKTOP\(CARDINAL\) = (\d+)$/m.exec(root)?.[1]);
  const stack = /^_NET_CLIENT_LIST_STACKING\(WINDOW\):[^\n]*$/m.exec(root)?.[0];
  if (!Number.isInteger(desktop) || !stack) {
    throw new Error("Monitor Chords requires an EWMH-compatible X11 window manager");
  }

  const display = targetDisplay(displays, target, { x, y });
  const windows = parseWindows(windowList, desktop);
  let candidate: string | undefined;
  for (const id of [...stack.matchAll(/0x[\da-f]+/gi)].map(([id]) => id).reverse()) {
    const frame = windows.get(Number(id));
    if (!frame || displayOfWindow(displays, frame) !== display) continue;
    const properties = await x11("xprop", "-id", id, "_NET_WM_STATE", "_NET_WM_WINDOW_TYPE").catch(
      () => undefined,
    );
    if (!properties || properties.includes("_NET_WM_STATE_HIDDEN")) continue;
    if (
      properties.includes("_NET_WM_WINDOW_TYPE(ATOM)") &&
      !/_NET_WM_WINDOW_TYPE_(?:NORMAL|DIALOG)\b/.test(properties)
    ) {
      continue;
    }
    candidate = id;
    break;
  }

  const point = center(display);
  await x11("xdotool", "mousemove", "--", String(point.x), String(point.y));
  if (candidate) await x11("xdotool", "windowactivate", "--sync", candidate);
}
