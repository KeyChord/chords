// Opt-in check against the Rift running on this Mac: `vp run test:live` in this package.
//
// It compiles a fixture app, switches to an empty Rift workspace, opens three fixture
// windows there, and runs chords' TOML commands through `sh -c`, as Chord does. Each step
// is checked against Rift's own state (`rift-cli query`). Cleanup quits the fixture,
// restores the two borrowed workspaces' layout modes, and returns to the original workspace
// and window. Windows on other workspaces are never moved; the pointer follows focus if
// Rift's `mouse_follows_focus` is on.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { runCommand, waitFor } from "@keychord/chordtest/macos";
import buildRiftHandler from "../src/js/rift";

type Frame = { origin: { x: number; y: number }; size: { width: number; height: number } };
type WindowId = { pid: number; idx: number };
type RiftWindow = {
  id: WindowId;
  bundle_id: string | null;
  frame: Frame;
  is_floating: boolean;
  is_focused: boolean;
};
type Workspace = {
  index: number;
  is_active: boolean;
  layout_mode: string;
  window_count: number;
  windows: RiftWindow[];
};
type LayoutNode = {
  node_type: "window" | "container";
  window_id: WindowId | null;
  frame: Frame;
  is_selected: boolean;
  is_fullscreen: boolean;
  is_fullscreen_within_gaps: boolean;
  layout_kind: string | null;
  role: string | null;
  children: LayoutNode[];
};

const live = process.env.CHORD_RIFT_LIVE_TEST === "1";
const BUNDLE_ID = "dev.keychord.chords-rift.fixture";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, { shell?: string; "@input:rift"?: string[] }> };

// These need a second display, or toggle Rift for the whole macOS Space, including the
// windows on the user's other workspaces. `rift.test.ts` still parses them with rift-cli.
const NOT_LIVE = new Set([";v", ...["w", "e", "n", "s", "l", "r", "u", "d"].map((d) => `;d${d}`)]);
for (const direction of ["l", "r", "u", "d"]) NOT_LIVE.add(`;t${direction}`);

async function rift<T>(...args: string[]): Promise<T> {
  return JSON.parse((await runCommand(["rift-cli", ...args], { timeout: 15_000 })).stdout) as T;
}

const id = (window: WindowId) => `${window.pid}:${window.idx}`;

/**
 * Rift's focused (main) window, when it is a fixture window. Window commands act on it, and
 * `;q` posts Command-W to its app. `query workspaces` can't tell: its `is_focused` falls back
 * to a workspace's last-focused window. These two queries both report the main window itself.
 */
async function fixtureFocus() {
  const [layout, applications] = await Promise.all([
    rift<{ focused_window: WindowId | null }>("query", "layout"),
    rift<{ pid: number; bundle_id: string | null; is_frontmost: boolean }[]>(
      "query",
      "applications",
    ),
  ]);
  const front = applications.find((application) => application.is_frontmost);
  const window = layout.focused_window;
  return front?.bundle_id === BUNDLE_ID && window?.pid === front.pid ? id(window) : undefined;
}

/**
 * Rift selects synchronously, but macOS focus follows through Accessibility events, and a
 * late focus event moves the selection back. Wait until the selected window is also Rift's
 * focused window, which is what a chord should achieve, and return it.
 */
const settled = async () => {
  let last = {};
  try {
    return await waitFor(async () => {
      const [window, focus, layout, applications] = await Promise.all([
        selected(),
        fixtureFocus(),
        rift<{ focused_window: WindowId | null }>("query", "layout"),
        rift<{ name: string; is_frontmost: boolean }[]>("query", "applications"),
      ]);
      last = {
        selected: window,
        focused: layout.focused_window && id(layout.focused_window),
        frontmost: applications.find((application) => application.is_frontmost)?.name,
      };
      return window && window === focus ? window : undefined;
    });
  } catch {
    throw new Error(
      `Selection and focus never agreed on a fixture window: ${JSON.stringify(last)}`,
    );
  }
};

/**
 * Wait until Rift has applied its layout to a window: its real frame matches the layout's.
 * Rift builds a scrolling layout's column geometry in that pass, which preset widths need.
 */
const applied = (window: string, workspace: number) =>
  waitFor(async () => {
    const [target, actual] = await Promise.all([
      frameOf(window),
      fixtureWindows(workspace).then((found) => found.find((entry) => id(entry.id) === window)),
    ]);
    const close = (a: number, b: number) => Math.abs(a - b) <= 1;
    return actual &&
      close(actual.frame.origin.x, target.origin.x) &&
      close(actual.frame.origin.y, target.origin.y) &&
      close(actual.frame.size.width, target.size.width) &&
      close(actual.frame.size.height, target.size.height)
      ? true
      : undefined;
  });

const ran = new Set<string>();
async function chord(input: string) {
  // Tests type the default prefix; the chords file spells it `<p>`.
  const key = input.replace(/^;/, "<p>");
  const shell = definition.chords[key]?.shell;
  if (!shell) throw new Error(`${input} has no shell command`);
  // Workspace switches and config reloads don't act on a window. Everything else waits until
  // Rift's focus is on the fixture, so a chord can never move or close the user's windows.
  if (!/^\[(?:f|,)/.test(input))
    await waitFor(fixtureFocus).catch(() => {
      throw new Error(`Stopped before ${input}: Rift's focused window isn't a fixture window`);
    });
  await runCommand(["/bin/sh", "-c", shell], { timeout: 15_000 });
  ran.add(key);
}
const riftHandler = buildRiftHandler();
/** Runs a chord bound to the `rift` handler (`;m`) as Chord would, after the same focus check. */
async function handled(input: string) {
  const key = input.replace(/^;/, "<p>");
  const args = definition.chords[key]?.["@input:rift"];
  if (!args) throw new Error(`${input} doesn't run the rift handler`);
  await waitFor(fixtureFocus).catch(() => {
    throw new Error(`Stopped before ${input}: Rift's focused window isn't a fixture window`);
  });
  await riftHandler(...(args as [string]));
  ran.add(key);
}
/** Test setup only: give a known window Rift's focus without going through a chord. */
const focusWindow = (window: string) => {
  const [pid, idx] = window.split(":").map(Number);
  return runCommand([
    "rift-cli",
    "execute",
    "window",
    "focus",
    "--window-id",
    JSON.stringify({ pid, idx }),
  ]);
};
const nodes = (node: LayoutNode): LayoutNode[] => [node, ...node.children.flatMap(nodes)];
const leaves = (node: LayoutNode) => nodes(node).filter((child) => child.node_type === "window");
const workspaces = () => rift<Workspace[]>("query", "workspaces");
const activeIndex = async () =>
  (await workspaces()).find((workspace) => workspace.is_active)?.index;
const tree = async () =>
  (await rift<{ container_tree: LayoutNode }>("query", "layout")).container_tree;
const selection = async () => nodes(await tree()).find((node) => node.is_selected);
const selected = async () => {
  const node = await selection();
  return node?.window_id ? id(node.window_id) : node?.node_type;
};
const frameOf = async (window: string) =>
  leaves(await tree()).find((node) => id(node.window_id!) === window)!.frame;
const order = async (axis: "x" | "y") =>
  leaves(await tree())
    .sort((a, b) => a.frame.origin[axis] - b.frame.origin[axis])
    .map((node) => id(node.window_id!));
const parentOf = (root: LayoutNode, window: string) =>
  nodes(root).find((node) =>
    node.children.some((child) => child.window_id && id(child.window_id) === window),
  )!;
const layoutMode = async (index: number) =>
  (await rift<{ index: number; layout_mode: string }[]>("query", "workspace-layout")).find(
    (workspace) => workspace.index === index,
  )?.layout_mode;
const frames = (workspace: Workspace | undefined) =>
  Object.fromEntries((workspace?.windows ?? []).map((window) => [id(window.id), window.frame]));
const fixtureWindows = async (index: number) =>
  ((await workspaces()).find((workspace) => workspace.index === index)?.windows ?? []).filter(
    (window) => window.bundle_id === BUNDLE_ID,
  );

/** Compile the fixture first, so the user's workspace changes only while the test runs. */
async function buildFixture() {
  const directory = await mkdtemp(join(tmpdir(), "chords-rift-fixture-"));
  const contents = join(directory, "RiftFixture.app", "Contents");
  const binary = join(contents, "MacOS", "RiftFixture");
  const output = join(directory, "fixture");
  await mkdir(join(contents, "MacOS"), { recursive: true });
  await Bun.write(
    join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
<key>CFBundleName</key><string>RiftFixture</string>
<key>CFBundleExecutable</key><string>RiftFixture</string>
<key>CFBundlePackageType</key><string>APPL</string></dict></plist>`,
  );
  const source = Bun.fileURLToPath(new URL("./RiftFixture.swift", import.meta.url));
  await runCommand(["/usr/bin/swiftc", "-parse-as-library", source, "-o", binary], {
    timeout: 120_000,
  });
  await runCommand([
    "/usr/bin/codesign",
    "--force",
    "--sign",
    "-",
    join(directory, "RiftFixture.app"),
  ]);
  let child: ReturnType<typeof Bun.spawn> | undefined;
  return {
    launch() {
      child = Bun.spawn([binary], {
        env: { ...process.env, CHORD_FIXTURE_OUTPUT: output, RIFT_FIXTURE_WINDOWS: "3" },
        stdout: "ignore",
        stderr: "inherit",
      });
    },
    /** Key events the fixture received, for diagnosing a failed close. */
    events: () =>
      Bun.file(`${output}.events`)
        .text()
        .catch(() => ""),
    async close() {
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await child.exited;
      }
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test.skipIf(!live)(
  "every chord kind drives the running Rift",
  async () => {
    const before = await workspaces();
    const home = before.find((workspace) => workspace.is_active)!;
    const homeFocus = home.windows.find((window) => window.is_focused);
    // Borrow the last two adjacent empty workspaces (extra, unnamed workspaces come last),
    // so `;f]` from the scratch workspace reaches the spare one, never the user's windows.
    const empty = before.filter(
      (workspace) => !workspace.is_active && workspace.window_count === 0 && workspace.index <= 8,
    );
    const [scratch, spare] =
      empty
        .map((workspace) => [workspace, empty.find((next) => next.index === workspace.index + 1)])
        .findLast(([, next]) => next) ?? [];
    if (!scratch || !spare)
      throw new Error("The live test needs two adjacent empty Rift workspaces on this display");
    let homeAfter: Workspace | undefined;
    const S = scratch.index;
    const T = spare.index;
    const fixture = await buildFixture();
    try {
      await chord(`;f${S}`);
      expect(await activeIndex()).toBe(S);

      fixture.launch();
      const windows = await waitFor(async () => {
        const found = await fixtureWindows(S);
        return found.length === 3 ? found.map((window) => id(window.id)) : undefined;
      }, 15_000);
      await focusWindow(windows[0]);

      // Focus and move in a horizontal split.
      await chord(";lt");
      expect(await layoutMode(S)).toBe("traditional");
      for (let step = 0; step < 3; step++) {
        await chord(";w");
        await settled();
      }
      const row = await order("x");
      expect(await settled()).toBe(row[0]);
      await chord(";e");
      expect(await settled()).toBe(row[1]);
      await chord(";e");
      expect(await settled()).toBe(row[2]);
      await chord(";w");
      const middle = row[1];
      expect(await settled()).toBe(middle);
      await chord(";g]");
      expect(await settled()).not.toBe(middle);
      await chord(";g[");
      expect(await settled()).toBe(middle);
      await chord(";r");
      expect(await order("x")).toEqual([row[0], row[2], middle]);
      await chord(";l");
      expect(await order("x")).toEqual(row);

      // Resize and balance.
      const width = (await frameOf(middle)).size.width;
      await chord(";rw=");
      expect((await frameOf(middle)).size.width).toBeGreaterThan(width);
      await chord(";b");
      expect((await frameOf(middle)).size.width).toBeCloseTo(width, 0);
      await chord(";rw-");
      expect((await frameOf(middle)).size.width).toBeLessThan(width);
      await chord(";b");
      await chord(";r=");
      const grown = (await frameOf(middle)).size.width;
      expect(grown).toBeGreaterThan(width);
      await chord(";r-");
      expect((await frameOf(middle)).size.width).toBeLessThan(grown);
      await chord(";b");

      // Join, select the joined container and back, then unjoin.
      for (const [join, neighbour] of [
        [";jr", row[2]],
        [";jl", row[0]],
      ] as const) {
        await chord(join);
        const root = await tree();
        const parent = parentOf(root, middle);
        expect(parent).not.toBe(root);
        expect(
          leaves(parent)
            .map((node) => id(node.window_id!))
            .sort(),
        ).toEqual([middle, neighbour].sort());
        await chord(";o");
        const container = await selection();
        expect(container?.node_type).toBe("container");
        expect(leaves(container!).length).toBe(2);
        await chord(";i");
        expect(await settled()).toBe(middle);
        await chord(";jx");
        expect(parentOf(await tree(), middle).children.length).toBe(3);
      }

      // Stacked containers.
      const kind = parentOf(await tree(), middle).layout_kind;
      await chord(";vs");
      expect(parentOf(await tree(), middle).layout_kind).not.toBe(kind);
      await chord(";vs");
      expect(parentOf(await tree(), middle).layout_kind).toBe(kind);

      // The same operations in a vertical split.
      await chord(";vo");
      expect(parentOf(await tree(), middle).layout_kind).not.toBe(kind);
      for (let step = 0; step < 3; step++) {
        await chord(";n");
        await settled();
      }
      const column = await order("y");
      expect(await settled()).toBe(column[0]);
      await chord(";s");
      expect(await settled()).toBe(column[1]);
      const center = column[1];
      await chord(";d");
      expect(await order("y")).toEqual([column[0], column[2], center]);
      await chord(";u");
      expect(await order("y")).toEqual(column);
      const height = (await frameOf(center)).size.height;
      await chord(";rh=");
      expect((await frameOf(center)).size.height).toBeGreaterThan(height);
      await chord(";rh-");
      await chord(";b");
      await chord(";rh-");
      expect((await frameOf(center)).size.height).toBeLessThan(height);
      await chord(";b");
      for (const [join, neighbour] of [
        [";jd", column[2]],
        [";ju", column[0]],
      ] as const) {
        await chord(join);
        expect(
          leaves(parentOf(await tree(), center))
            .map((node) => id(node.window_id!))
            .sort(),
        ).toEqual([center, neighbour].sort());
        await chord(";jx");
      }
      await chord(";vo");
      expect(parentOf(await tree(), center).layout_kind).toBe(kind);

      // Floating, and moving focus between the floating and tiled layers.
      await chord(";vf");
      expect(
        (await fixtureWindows(S)).find((window) => id(window.id) === center)?.is_floating,
      ).toBe(true);
      expect(leaves(await tree()).length).toBe(2);
      await waitFor(async () => ((await fixtureFocus()) === center ? true : undefined));
      await chord(";gf");
      const tiled = await waitFor(async () => {
        const window = await fixtureFocus();
        return window && window !== center ? window : undefined;
      });
      expect(leaves(await tree()).map((node) => id(node.window_id!))).toContain(tiled);
      await chord(";gf");
      await waitFor(async () => ((await fixtureFocus()) === center ? true : undefined));
      await chord(";vf");
      expect((await fixtureWindows(S)).every((window) => !window.is_floating)).toBe(true);
      expect(leaves(await tree()).length).toBe(3);

      // Fullscreen toggles.
      expect(await settled()).toBe(center);
      await chord(";zf");
      expect((await selection())?.is_fullscreen).toBe(true);
      await chord(";zf");
      expect((await selection())?.is_fullscreen).toBe(false);
      await chord(";zg");
      expect((await selection())?.is_fullscreen_within_gaps).toBe(true);
      await chord(";zg");
      expect((await selection())?.is_fullscreen_within_gaps).toBe(false);

      // Layout modes.
      for (const [input, mode] of [
        [";lf", "floating"],
        [";lb", "bsp"],
        [";ls", "stack"],
        [";lc", "scrolling"],
      ]) {
        await chord(input);
        expect(await layoutMode(S)).toBe(mode);
      }

      // Scrolling columns.
      const scrolled = await settled();
      await applied(scrolled, S);
      const columnWidth = (await frameOf(scrolled)).size.width;
      await chord(";cw]");
      const preset = (await frameOf(scrolled)).size.width;
      expect(preset).not.toBeCloseTo(columnWidth, 0);
      await chord(";cw[");
      expect((await frameOf(scrolled)).size.width).not.toBeCloseTo(preset, 0);
      await chord(";cc");
      await chord(";cc");

      // Master/stack.
      await chord(";lm");
      expect(await layoutMode(S)).toBe("master_stack");
      const area = async (role: "master" | "stack") =>
        (await tree()).children.find((node) => node.role === role)!;
      const masters = leaves(await area("master")).length;
      await chord(";lmc=");
      expect(leaves(await area("master")).length).toBe(masters + 1);
      await chord(";lmc-");
      expect(leaves(await area("master")).length).toBe(masters);
      const masterWidth = (await area("master")).frame.size.width;
      await chord(";lm=");
      expect((await area("master")).frame.size.width).toBeGreaterThan(masterWidth);
      await chord(";lm-");
      expect((await area("master")).frame.size.width).toBeCloseTo(masterWidth, 0);
      const stacked = id(leaves(await area("stack"))[0].window_id!);
      await focusWindow(stacked);
      expect(await settled()).toBe(stacked);
      await chord(";lmp");
      expect(leaves(await area("master")).map((node) => id(node.window_id!))).toContain(stacked);
      const firstMaster = id(leaves(await area("master"))[0].window_id!);
      const firstStack = id(leaves(await area("stack"))[0].window_id!);
      await chord(";lms");
      expect(id(leaves(await area("master"))[0].window_id!)).toBe(firstStack);
      expect(id(leaves(await area("stack"))[0].window_id!)).toBe(firstMaster);
      // `;p` promotes like `;lmp`, and `;m` focuses the first master window.
      const promoted = id(leaves(await area("stack"))[0].window_id!);
      await focusWindow(promoted);
      expect(await settled()).toBe(promoted);
      await chord(";p");
      expect(leaves(await area("master")).map((node) => id(node.window_id!))).toContain(promoted);
      const master = id(leaves(await area("master"))[0].window_id!);
      const stackedAgain = id(leaves(await area("stack"))[0].window_id!);
      await focusWindow(stackedAgain);
      expect(await settled()).toBe(stackedAgain);
      await handled(";m");
      expect(await settled()).toBe(master);

      // Workspaces.
      await settled();
      await chord(`;m${T}`);
      // Rift then focuses another window here; a late focus event would switch back to it.
      await settled();
      expect(await activeIndex()).toBe(S);
      expect((await fixtureWindows(S)).length).toBe(2);
      const moved = (await fixtureWindows(T)).map((window) => id(window.id));
      expect(moved.length).toBe(1);
      await chord(`;f${T}`);
      expect(await settled()).toBe(moved[0]);
      expect(await activeIndex()).toBe(T);
      await chord(";fk");
      await settled();
      expect(await activeIndex()).toBe(S);
      await chord(";fk");
      expect(await settled()).toBe(moved[0]);
      expect(await activeIndex()).toBe(T);
      await chord(`;mf${S}`);
      expect(await settled()).toBe(moved[0]);
      expect(await activeIndex()).toBe(S);
      expect((await fixtureWindows(S)).map((window) => id(window.id))).toContain(moved[0]);
      expect((await fixtureWindows(T)).length).toBe(0);
      await chord(";f]");
      expect(await activeIndex()).toBe(T);
      await chord(";f[");
      await settled();
      expect(await activeIndex()).toBe(S);

      // Config reload keeps the configuration.
      const config = await rift<unknown>("execute", "config", "get");
      await chord(";,r");
      expect(await rift<unknown>("execute", "config", "get")).toEqual(config);

      // Quit the focused window last.
      const closing = await settled();
      await chord(";q");
      await waitFor(async () => {
        const remaining = (await fixtureWindows(S)).map((window) => id(window.id));
        return remaining.length === 2 && !remaining.includes(closing) ? true : undefined;
      }, 10_000).catch(async () => {
        throw new Error(
          `;q did not close ${closing}; fixture key events:\n${await fixture.events()}`,
        );
      });

      // Every chord kind ran, except the ones above; digits share one command per kind.
      const kinds = (input: string) => input.replace(/^(\[(?:f|mf|m))\d$/, "$1N");
      const untested = Object.keys(definition.chords).filter(
        (input) =>
          !input.startsWith("?") &&
          !NOT_LIVE.has(input) &&
          ![...ran].some((done) => kinds(done) === kinds(input)),
      );
      expect(untested).toEqual([]);
    } finally {
      await fixture.close();
      await waitFor(
        async () =>
          (await workspaces()).every((workspace) =>
            workspace.windows.every((window) => window.bundle_id !== BUNDLE_ID),
          )
            ? true
            : undefined,
        10_000,
      ).catch(() => undefined);
      for (const workspace of [scratch, spare])
        await runCommand([
          "rift-cli",
          "execute",
          "workspace",
          "set-layout",
          workspace.layout_mode,
          "--workspace-id",
          String(workspace.index),
        ]);
      await runCommand(["rift-cli", "execute", "workspace", "switch", String(home.index)]);
      if (homeFocus)
        await runCommand([
          "rift-cli",
          "execute",
          "window",
          "focus",
          "--window-id",
          JSON.stringify(homeFocus.id),
        ]);
      // Report changes to the user's own workspace even when a step failed.
      homeAfter = (await workspaces()).find((workspace) => workspace.index === home.index);
      const changed = JSON.stringify(frames(homeAfter)) !== JSON.stringify(frames(home));
      if (changed)
        console.warn("Windows on the original workspace changed:", {
          before: frames(home),
          after: frames(homeAfter),
        });
    }

    // The user's own workspace kept its windows and their frames.
    expect(frames(homeAfter)).toEqual(frames(home));
    expect(await layoutMode(S)).toBe(scratch.layout_mode);
    expect(await layoutMode(T)).toBe(spare.layout_mode);
  },
  180_000,
);
