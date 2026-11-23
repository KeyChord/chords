//#region src/js/workspace.ts
const SWITCH = "SWITCH";
const MOVE = "MOVE";
const PREVIOUS = "PREVIOUS";
const NEXT = "NEXT";
async function wmctrl(args) {
  const executable = Bun.which("wmctrl");
  if (!executable) throw new Error("Install wmctrl to use Linux Workspace Chords");
  const child = Bun.spawn([executable, ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 3e3,
    maxBuffer: 1048576,
  });
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (status !== 0) throw new Error(stderr.trim() || `wmctrl exited with status ${status}`);
  return stdout;
}
async function selectWorkspace(action, target, focusedWindowId, run = wmctrl) {
  if (action !== SWITCH && action !== MOVE) throw new TypeError("Unknown workspace action");
  if (
    target !== PREVIOUS &&
    target !== NEXT &&
    (typeof target !== "string" || !/^[1-9]$/.test(target))
  )
    throw new TypeError("Expected a workspace number from 1 to 9, PREVIOUS, or NEXT");
  if (
    action === MOVE &&
    (focusedWindowId === null ||
      !Number.isInteger(focusedWindowId) ||
      focusedWindowId < 1 ||
      focusedWindowId > 4294967295)
  )
    throw new Error("No window was focused when the chord started");
  const desktops = /* @__PURE__ */ new Set();
  let current;
  for (const line of (await run(["-d"])).split("\n")) {
    const match = /^(\d+)\s+([*-])\s/.exec(line);
    if (!match) continue;
    const index = Number(match[1]);
    desktops.add(index);
    if (match[2] === "*") current = index;
  }
  if (current === void 0) throw new Error("No active X11 workspace was reported by wmctrl");
  const windowId = action === MOVE ? focusedWindowId : null;
  if (windowId !== null) {
    const source = (await run(["-l"]))
      .split("\n")
      .find((line) => {
        const [id] = line.split(/\s+/, 1);
        return /^0x[\da-f]+$/i.test(id) && Number(id) === windowId;
      })
      ?.split(/\s+/, 2)[1];
    if (source === void 0 || !desktops.has(Number(source)))
      throw new Error("The captured window is no longer on a single workspace");
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
function buildWorkspaceHandler() {
  return function workspace(action, target) {
    return selectWorkspace(action, target, this.focusedWindowId);
  };
}
//#endregion
export { buildWorkspaceHandler as default, selectWorkspace };
