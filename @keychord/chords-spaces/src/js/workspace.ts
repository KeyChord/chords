type RunCommand = (args: string[]) => Promise<string>;

const SWITCH = "SWITCH";
const MOVE = "MOVE";
const PREVIOUS = "PREVIOUS";
const NEXT = "NEXT";

async function wmctrl(args: string[]): Promise<string> {
  const executable = Bun.which("wmctrl");
  if (!executable) throw new Error("Install wmctrl to use Linux Workspace Chords");

  const child = Bun.spawn([executable, ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 3_000,
    maxBuffer: 1024 * 1024,
  });
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (status !== 0) throw new Error(stderr.trim() || `wmctrl exited with status ${status}`);
  return stdout;
}

export async function selectWorkspace(
  action: unknown,
  target: unknown,
  focusedWindowId: number | null,
  run: RunCommand = wmctrl,
): Promise<void> {
  if (action !== SWITCH && action !== MOVE) throw new TypeError("Unknown workspace action");
  if (
    target !== PREVIOUS &&
    target !== NEXT &&
    (typeof target !== "string" || !/^[1-9]$/.test(target))
  ) {
    throw new TypeError("Expected a workspace number from 1 to 9, PREVIOUS, or NEXT");
  }
  if (
    action === MOVE &&
    (focusedWindowId === null ||
      !Number.isInteger(focusedWindowId) ||
      focusedWindowId < 1 ||
      focusedWindowId > 0xffffffff)
  ) {
    throw new Error("No window was focused when the chord started");
  }

  const desktops = new Set<number>();
  let current: number | undefined;
  for (const line of (await run(["-d"])).split("\n")) {
    const match = /^(\d+)\s+([*-])\s/.exec(line);
    if (!match) continue;
    const index = Number(match[1]);
    desktops.add(index);
    if (match[2] === "*") current = index;
  }
  if (current === undefined) throw new Error("No active X11 workspace was reported by wmctrl");

  const windowId = action === MOVE ? focusedWindowId : null;
  if (windowId !== null) {
    const window = (await run(["-l"])).split("\n").find((line) => {
      const [id] = line.split(/\s+/, 1);
      return /^0x[\da-f]+$/i.test(id) && Number(id) === windowId;
    });
    const source = window?.split(/\s+/, 2)[1];
    if (source === undefined || !desktops.has(Number(source))) {
      throw new Error("The captured window is no longer on a single workspace");
    }
    current = Number(source);
  }

  const relative = target === PREVIOUS || target === NEXT;
  const index = relative ? current + (target === NEXT ? 1 : -1) : Number(target) - 1;
  if (!desktops.has(index)) {
    if (relative) return;
    throw new Error(`Workspace ${target} does not exist`);
  }
  if (index === current) return;
  const destination = String(index);
  await run(
    windowId === null
      ? ["-s", destination]
      : ["-i", "-r", `0x${windowId.toString(16)}`, "-t", destination],
  );
}

export default function buildWorkspaceHandler() {
  return function workspace(
    this: { focusedWindowId: number | null },
    action: unknown,
    target: unknown,
  ) {
    return selectWorkspace(action, target, this.focusedWindowId);
  };
}
