import { expect, test } from "bun:test";
import buildRiftHandler, {
  FOCUS_MASTER,
  MOVE_BACKWARD,
  MOVE_FORWARD,
  MOVE_TO_BOTTOM,
  MOVE_TO_TOP,
  type LayoutNode,
  type WindowId,
} from "../src/js/rift";

const window = (pid: number, idx: number, width = 800, height = 600): LayoutNode => ({
  node_type: "window",
  window_id: { pid, idx },
  frame: { size: { width, height } },
  role: null,
  children: [],
});
const container = (role: string | null, children: LayoutNode[]): LayoutNode => ({
  node_type: "container",
  window_id: null,
  frame: { size: { width: 1728, height: 1083 } },
  role,
  children,
});

/** A fake rift-cli that answers `query layout` with this tree and records every call. */
function fakeCli(tree: LayoutNode | null, selected: WindowId | null = null) {
  const calls: string[][] = [];
  const cli = async (args: string[]) => {
    calls.push(args);
    return args[0] === "query"
      ? JSON.stringify({ container_tree: tree, selected_window: selected })
      : "";
  };
  return { calls, rift: buildRiftHandler(cli) };
}
const focus = ({ pid, idx }: WindowId) => [
  "execute",
  "window",
  "focus",
  "--window-id",
  `{"pid":${pid},"idx":${idx}}`,
];

// The shape `rift-cli query layout` reports for a master/stack workspace.
const masterStack = (master: LayoutNode[]) =>
  container(null, [
    container("master", master),
    container("stack", [window(5165, 2910), window(4750, 2587)]),
  ]);

test("focuses the first window in the master area", async () => {
  const { calls, rift } = fakeCli(masterStack([window(17592, 858), window(31839, 2696)]));
  await rift(FOCUS_MASTER);
  expect(calls).toEqual([["query", "layout"], focus({ pid: 17592, idx: 858 })]);
});

test("skips a hidden master window, which keeps its slot with a 0×0 frame", async () => {
  const { calls, rift } = fakeCli(masterStack([window(1, 1, 0, 0), window(31839, 2696)]));
  await rift(FOCUS_MASTER);
  expect(calls.at(-1)).toEqual(focus({ pid: 31839, idx: 2696 }));
});

test("does nothing without a visible master window", async () => {
  for (const tree of [
    masterStack([window(1, 1, 0, 0)]),
    container(null, [window(5165, 2910), window(4750, 2587)]),
    null,
  ]) {
    const { calls, rift } = fakeCli(tree);
    await rift(FOCUS_MASTER);
    expect(calls).toEqual([["query", "layout"]]);
  }
});

const swap = (a: WindowId, b: WindowId) => [
  "execute",
  "layout",
  "swap-windows",
  `{"pid":${a.pid},"idx":${a.idx}}`,
  `{"pid":${b.pid},"idx":${b.idx}}`,
];
const id = (idx: number): WindowId => ({ pid: idx * 10, idx });
const tiled = (idx: number, width?: number, height?: number) =>
  window(idx * 10, idx, width, height);
// Two master windows and three stack windows: the order is 1 2 | 3 4 5.
const twoMasters = (stack = [tiled(3), tiled(4), tiled(5)], master = [tiled(1), tiled(2)]) =>
  container(null, [container("master", master), container("stack", stack)]);

/** The rift-cli calls a move makes with this window selected. */
async function move(action: string, selected: number | null, tree = twoMasters()) {
  const { calls, rift } = fakeCli(tree, selected === null ? null : id(selected));
  await rift(action);
  expect(calls[0]).toEqual(["query", "layout"]);
  return calls.slice(1);
}

test("forwards swaps with the window one place closer to the master area", async () => {
  expect(await move(MOVE_FORWARD, 5)).toEqual([swap(id(5), id(4))]);
  expect(await move(MOVE_FORWARD, 2)).toEqual([swap(id(2), id(1))]);
  // The first stack window trades places with the last master window.
  expect(await move(MOVE_FORWARD, 3)).toEqual([swap(id(3), id(2))]);
});

test("backwards swaps with the window one place further from the master area", async () => {
  expect(await move(MOVE_BACKWARD, 1)).toEqual([swap(id(1), id(2))]);
  expect(await move(MOVE_BACKWARD, 2)).toEqual([swap(id(2), id(3))]);
  expect(await move(MOVE_BACKWARD, 4)).toEqual([swap(id(4), id(5))]);
});

test("the order follows Rift's roles, not the tree, so a master area on the right works", async () => {
  // With `master_side = "right"`, the stack container comes first in the tree.
  const tree = container(null, [
    container("stack", [tiled(3), tiled(4)]),
    container("master", [tiled(1)]),
  ]);
  expect(await move(MOVE_FORWARD, 3, tree)).toEqual([swap(id(3), id(1))]);
  expect(await move(MOVE_BACKWARD, 1, tree)).toEqual([swap(id(1), id(3))]);
});

test("moves skip hidden windows, which keep their slot with a 0×0 frame", async () => {
  const tree = twoMasters([tiled(3), tiled(4, 0, 0), tiled(5)]);
  expect(await move(MOVE_FORWARD, 5, tree)).toEqual([swap(id(5), id(3))]);
  expect(await move(MOVE_BACKWARD, 3, tree)).toEqual([swap(id(3), id(5))]);
});

test("top and bottom pass every window up to either end of the window's own area", async () => {
  const stack = [3, 4, 5, 6].map((idx) => tiled(idx));
  const tree = twoMasters(stack);
  // Swapping past each window in turn leaves the others in order: 3 4 5 6 → 5 3 4 6.
  expect(await move(MOVE_TO_TOP, 5, tree)).toEqual([swap(id(5), id(4)), swap(id(5), id(3))]);
  expect(await move(MOVE_TO_BOTTOM, 4, tree)).toEqual([swap(id(4), id(5)), swap(id(4), id(6))]);
  // In the master area they stay within it.
  const masters = twoMasters(stack, [tiled(1), tiled(2), tiled(7)]);
  expect(await move(MOVE_TO_TOP, 7, masters)).toEqual([swap(id(7), id(2)), swap(id(7), id(1))]);
  expect(await move(MOVE_TO_BOTTOM, 1, masters)).toEqual([swap(id(1), id(2)), swap(id(1), id(7))]);
  // Already at the front or end of its area, so no crossing into the other one.
  expect(await move(MOVE_TO_TOP, 3, tree)).toEqual([]);
  expect(await move(MOVE_TO_BOTTOM, 2, tree)).toEqual([]);
  // Hidden windows are skipped.
  const hidden = twoMasters([tiled(3), tiled(4, 0, 0), tiled(5)]);
  expect(await move(MOVE_TO_TOP, 5, hidden)).toEqual([swap(id(5), id(3))]);
});

test("moves do nothing at either end, or without a selected master/stack window", async () => {
  expect(await move(MOVE_FORWARD, 1)).toEqual([]);
  expect(await move(MOVE_BACKWARD, 5)).toEqual([]);
  expect(await move(MOVE_TO_TOP, 1)).toEqual([]);
  expect(await move(MOVE_TO_BOTTOM, 5)).toEqual([]);
  // No selection, a floating or unknown window, or a hidden one.
  expect(await move(MOVE_FORWARD, null)).toEqual([]);
  expect(await move(MOVE_FORWARD, 9)).toEqual([]);
  expect(await move(MOVE_FORWARD, 4, twoMasters([tiled(3), tiled(4, 0, 0)]))).toEqual([]);
  // Other layouts have no master and stack containers.
  const bsp = container(null, [tiled(1), container(null, [tiled(2), tiled(3)])]);
  for (const action of [MOVE_FORWARD, MOVE_BACKWARD, MOVE_TO_TOP, MOVE_TO_BOTTOM])
    expect(await move(action, 2, bsp)).toEqual([]);
  expect(await move(MOVE_FORWARD, 1, null as unknown as LayoutNode)).toEqual([]);
});

test("rejects unknown actions and rift-cli failures", async () => {
  const { calls, rift } = fakeCli(null);
  for (const action of ["FOCUS", "toString"])
    expect(await rift(action).then(undefined, (error) => error)).toBeInstanceOf(TypeError);
  expect(calls).toEqual([]);
  const failing = buildRiftHandler(async () => {
    throw new Error("rift-cli query layout failed (exit 1)");
  });
  expect(await failing(FOCUS_MASTER).then(undefined, (error) => error)).toHaveProperty(
    "message",
    "rift-cli query layout failed (exit 1)",
  );
});
