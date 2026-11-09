export type WindowId = { pid: number; idx: number };

export type LayoutNode = {
  node_type: "window" | "container";
  window_id: WindowId | null;
  frame: { size: { width: number; height: number } };
  role: string | null;
  children: LayoutNode[];
};

export type Layout = { container_tree: LayoutNode | null };

/** Runs `rift-cli` with these arguments and resolves with its stdout. */
export type RiftCli = (args: string[]) => Promise<string>;

export const FOCUS_MASTER = "FOCUS_MASTER";

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

/**
 * The first window in the master area that Rift gives space to. Hidden and minimized windows
 * keep their slot with a 0×0 frame, and focusing one would show nothing. Undefined outside
 * the master/stack layout, which is the only one with a master area.
 */
export function masterWindow(layout: Layout): WindowId | undefined {
  const master =
    layout.container_tree && nodes(layout.container_tree).find((node) => node.role === "master");
  if (!master) return undefined;
  return (
    nodes(master).find(
      (node) =>
        node.node_type === "window" &&
        node.window_id &&
        node.frame.size.width > 0 &&
        node.frame.size.height > 0,
    )?.window_id ?? undefined
  );
}

export const focusArgs = ({ pid, idx }: WindowId) => [
  "execute",
  "window",
  "focus",
  "--window-id",
  JSON.stringify({ pid, idx }),
];

export default function buildRiftHandler(cli: RiftCli = createRiftCli()) {
  return async function rift(action: string): Promise<void> {
    if (action !== FOCUS_MASTER) throw new TypeError(`Unknown Rift action: ${String(action)}`);
    const window = masterWindow(JSON.parse(await cli(["query", "layout"])) as Layout);
    // Like Rift's own master commands, do nothing outside master/stack.
    if (window) await cli(focusArgs(window));
  };
}
