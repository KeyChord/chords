export type WindowId = { pid: number; idx: number };

export type LayoutNode = {
  node_type: "window" | "container";
  window_id: WindowId | null;
  frame: { size: { width: number; height: number } };
  role: string | null;
  children: LayoutNode[];
};

export type Layout = {
  container_tree: LayoutNode | null;
  selected_window?: WindowId | null;
};

/** Runs `rift-cli` with these arguments and resolves with its stdout. */
export type RiftCli = (args: string[]) => Promise<string>;

export const FOCUS_MASTER = "FOCUS_MASTER";
/** Swaps the selected window with its neighbor one place closer to the master area. */
export const MOVE_FORWARD = "MOVE_FORWARD";
/** Swaps the selected window with its neighbor one place further from the master area. */
export const MOVE_BACKWARD = "MOVE_BACKWARD";
/** Moves the selected window to the front of its area: the stack, or the master area. */
export const MOVE_TO_TOP = "MOVE_TO_TOP";
/** Moves the selected window to the end of its area: the stack, or the master area. */
export const MOVE_TO_BOTTOM = "MOVE_TO_BOTTOM";

export type Move = "forward" | "backward" | "top" | "bottom";
const MOVES: Record<string, Move> = {
  [MOVE_FORWARD]: "forward",
  [MOVE_BACKWARD]: "backward",
  [MOVE_TO_TOP]: "top",
  [MOVE_TO_BOTTOM]: "bottom",
};

/** Looks `rift-cli` up on the PATH Chord recovers from the login shell, like shell chords. */
export function createRiftCli(timeout = 15_000): RiftCli {
  return async (args) => {
    const binary = Bun.which("rift-cli");
    if (!binary) throw new Error("Install Rift, with rift-cli on your login shell's PATH");
    const child = Bun.spawn([binary, ...args], { stdout: "pipe", stderr: "pipe", timeout });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) {
      const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join("; ");
      throw new Error(
        `rift-cli ${args.join(" ")} failed${child.signalCode ? ` (terminated; timeout ${timeout}ms)` : ` (exit ${code})`}${detail ? `: ${detail}` : ""}`,
      );
    }
    return stdout;
  };
}

const nodes = (node: LayoutNode): LayoutNode[] => [node, ...node.children.flatMap(nodes)];

/** Rift's master or stack container. Only the master/stack layout has them. */
const area = (layout: Layout, role: "master" | "stack") =>
  layout.container_tree && nodes(layout.container_tree).find((node) => node.role === role);

/**
 * The windows in a container that Rift gives space to. Hidden and minimized windows keep
 * their slot with a 0×0 frame, and focusing or moving one would show nothing.
 */
const visibleWindows = (container: LayoutNode | null | undefined): WindowId[] =>
  container
    ? nodes(container).flatMap((node) =>
        node.node_type === "window" &&
        node.window_id &&
        node.frame.size.width > 0 &&
        node.frame.size.height > 0
          ? [node.window_id]
          : [],
      )
    : [];

/** The first visible window in the master area. Undefined outside master/stack. */
export function masterWindow(layout: Layout): WindowId | undefined {
  return visibleWindows(area(layout, "master"))[0];
}

/**
 * The visible windows in the master area, then those in the stack: the order Rift's
 * master/stack layout keeps, whichever side the master area is on. Promoting a window puts it
 * first, and a window pushed out of the master area becomes the first stack window, so the
 * front of the stack is next in line for the master area. Empty outside master/stack.
 */
export function stackOrder(layout: Layout): WindowId[] {
  return [...visibleWindows(area(layout, "master")), ...visibleWindows(area(layout, "stack"))];
}

const sameWindow = (a: WindowId, b: WindowId) => a.pid === b.pid && a.idx === b.idx;

/**
 * The windows that `window` swaps with, in turn, to make a move in `stackOrder`. Forwards
 * (towards the master area) and backwards swap once, with the next window either way, across
 * the master/stack boundary. Top and bottom stay within the window's own area and pass every
 * window up to its front or end, which keeps the others in order. Empty when there is nowhere
 * to go, and when `window` isn't a visible tiled window in a master/stack layout.
 */
export function moveSwaps(layout: Layout, window: WindowId, move: Move): WindowId[] {
  const lists =
    move === "forward" || move === "backward"
      ? [stackOrder(layout)]
      : [visibleWindows(area(layout, "master")), visibleWindows(area(layout, "stack"))];
  for (const windows of lists) {
    const index = windows.findIndex((other) => sameWindow(other, window));
    if (index === -1) continue;
    const before = windows.slice(0, index).reverse();
    const after = windows.slice(index + 1);
    return { forward: before.slice(0, 1), backward: after.slice(0, 1), top: before, bottom: after }[
      move
    ];
  }
  return [];
}

export const focusArgs = ({ pid, idx }: WindowId) => [
  "execute",
  "window",
  "focus",
  "--window-id",
  JSON.stringify({ pid, idx }),
];

/** `a` and `b` trade places, and Rift keeps its selection on whichever of them had it. */
export const swapArgs = (a: WindowId, b: WindowId) => [
  "execute",
  "layout",
  "swap-windows",
  JSON.stringify({ pid: a.pid, idx: a.idx }),
  JSON.stringify({ pid: b.pid, idx: b.idx }),
];

export default function buildRiftHandler(cli: RiftCli = createRiftCli()) {
  return async function rift(action: string): Promise<void> {
    if (action !== FOCUS_MASTER && !Object.hasOwn(MOVES, action))
      throw new TypeError(`Unknown Rift action: ${String(action)}`);
    const layout = JSON.parse(await cli(["query", "layout"])) as Layout;
    // Like Rift's own master commands, do nothing outside master/stack.
    if (action === FOCUS_MASTER) {
      const window = masterWindow(layout);
      if (window) await cli(focusArgs(window));
      return;
    }
    // Rift's own layout commands act on its selection, the window it last focused.
    const selected = layout.selected_window;
    if (!selected) return;
    // Each swap names both windows, so it doesn't depend on what Rift has selected by then.
    for (const other of moveSwaps(layout, selected, MOVES[action]!))
      await cli(swapArgs(selected, other));
  };
}
