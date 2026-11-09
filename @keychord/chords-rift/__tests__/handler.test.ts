import { expect, test } from "bun:test";
import buildRiftHandler, { FOCUS_MASTER, type LayoutNode, type WindowId } from "../src/js/rift";

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
function fakeCli(tree: LayoutNode | null) {
  const calls: string[][] = [];
  const cli = async (args: string[]) => {
    calls.push(args);
    return args[0] === "query" ? JSON.stringify({ container_tree: tree }) : "";
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

test("rejects unknown actions and rift-cli failures", async () => {
  const { calls, rift } = fakeCli(null);
  expect(await rift("FOCUS").then(undefined, (error) => error)).toBeInstanceOf(TypeError);
  expect(calls).toEqual([]);
  const failing = buildRiftHandler(async () => {
    throw new Error("rift-cli query layout failed (exit 1)");
  });
  expect(await failing(FOCUS_MASTER).then(undefined, (error) => error)).toHaveProperty(
    "message",
    "rift-cli query layout failed (exit 1)",
  );
});
