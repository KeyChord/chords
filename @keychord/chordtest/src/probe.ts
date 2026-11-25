import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withChordPackage } from "./chord-app";
import { requireMacOSVM } from "./runtime";
import { runCommand, waitFor } from "./macos";

export type AXNode = {
  role?: string;
  subrole?: string;
  title?: string;
  id?: string;
  description?: string;
  mark?: string;
  sortDirection?: string;
  key?: string;
  keyModifiers?: number;
  keyGlyph?: number;
  keyVirtual?: number;
  enabled?: boolean;
  selected?: boolean;
  minimized?: boolean;
  focused?: boolean;
  url?: string;
  value?: string | number | boolean;
  position?: [number, number];
  size?: [number, number];
  children?: AXNode[];
};

export function flattenAX(nodes: AXNode[]): AXNode[] {
  return nodes.flatMap((node) => [node, ...flattenAX(node.children ?? [])]);
}

export async function withMacOSProbe<T>(body: (probe: MacOSProbe) => Promise<T>): Promise<T> {
  requireMacOSVM();
  const prepared = process.env.CHORD_TESTING_PROBE;
  if (prepared) return await body(new MacOSProbe(prepared));
  const scratch = await mkdtemp(join(tmpdir(), "chordtest-probe-"));
  try {
    const executable = join(scratch, "macos-probe");
    await runCommand(
      [
        "/usr/bin/swiftc",
        Bun.fileURLToPath(new URL("./fixtures/MacOSProbe.swift", import.meta.url)),
        "-o",
        executable,
      ],
      { timeout: 120_000 },
    );
    return await body(new MacOSProbe(executable));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

/** Assert shared window shortcuts on a real app with a saved document and no quit prompt. */
export async function testWindowShortcuts(testURL: string, prefix: string): Promise<void> {
  await withChordPackage(testURL, (app) =>
    withMacOSProbe(async (probe) => {
      const scratch = await mkdtemp(join(tmpdir(), "chordtest-window-shortcuts-"));
      try {
        const bundleId = "com.apple.TextEdit";
        const file = join(scratch, "Chordtest window.txt");
        await Bun.write(file, "Chordtest\n");
        await probe.activate(bundleId, file);
        const minimized = async () =>
          (await probe.windows(bundleId)).some(
            (node) => node.title === "Chordtest window.txt" && node.minimized,
          );
        await waitFor(
          async () =>
            (await probe.windows(bundleId)).some(
              (window) => window.title === "Chordtest window.txt",
            )
              ? true
              : undefined,
          12_000,
        );
        await app.runChecked(`${prefix}h`);
        await waitFor(async () => ((await probe.hidden(bundleId)) ? true : undefined), 12_000);
        await probe.activate(bundleId, file);
        await app.runChecked(`${prefix}m`);
        await waitFor(async () => ((await minimized()) ? true : undefined), 12_000);
        await probe.activate(bundleId);
        await app.runChecked(`${prefix}q`);
        await waitFor(async () => (!(await probe.running(bundleId)) ? true : undefined), 12_000);
      } finally {
        await rm(scratch, { recursive: true, force: true });
      }
    }),
  );
}

export class MacOSProbe {
  constructor(private readonly executable: string) {}

  private async read<T>(...args: string[]): Promise<T> {
    const { stdout } = await runCommand([this.executable, ...args]);
    return JSON.parse(stdout);
  }

  async runAppleScript(
    appTitle: string,
    source: readonly string[],
    args: readonly string[] = [],
    { timeout = 25_000 }: { timeout?: number } = {},
  ): Promise<string> {
    requireMacOSVM();
    const script = Bun.spawn(
      ["/usr/bin/osascript", ...source.flatMap((line) => ["-e", line]), ...args],
      { stdout: "pipe", stderr: "pipe", timeout },
    );
    let completed = false;
    const result = Promise.all([
      new Response(script.stdout).text(),
      new Response(script.stderr).text(),
      script.exited,
    ]).then((status) => {
      completed = true;
      return status;
    });

    const notification = "com.apple.UserNotificationCenter";
    const target = appTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const permission = new RegExp(
      'tart-guest-agent.*wants access to control\\s*["“]?' + target + '(?=["”\\s.]|$)',
    );
    try {
      await waitFor(async () => {
        if (completed) return true;
        const windows = await this.windows(notification, 7).catch(() => []);
        for (const window of windows) {
          const controls = flattenAX([window]);
          const message = controls
            .flatMap(({ title, description, value }) => [title, description, value])
            .join(" ");
          if (!permission.test(message)) continue;
          const allow = controls.find(
            (node) =>
              node.role === "AXButton" &&
              [node.title, node.description].includes("Allow") &&
              node.enabled &&
              node.position &&
              node.size,
          );
          if (allow?.position && allow.size) {
            const [x, y] = allow.position;
            const [width, height] = allow.size;
            await this.clickPoint(x + width / 2, y + height / 2);
            return true;
          }
        }
      }, 12_000);
    } catch (error) {
      script.kill();
      await result;
      throw error;
    }
    const [stdout, stderr, code] = await result;
    if (code !== 0) throw new Error(appTitle + " AppleScript failed: " + stderr.trim());
    return stdout.trim();
  }

  front(): Promise<string> {
    return this.read("front");
  }

  screenLocked(): Promise<boolean> {
    return this.read("screen-locked");
  }

  running(bundleId: string): Promise<boolean> {
    return this.read("running", bundleId);
  }

  hidden(bundleId: string): Promise<boolean> {
    return this.read("hidden", bundleId);
  }

  cursor(): Promise<[number, number]> {
    return this.read("cursor");
  }

  windowOrder(): Promise<string[]> {
    return this.read("window-order");
  }

  screenWindows(): Promise<{ owner: string; number: number; title: string }[]> {
    return this.read("screen-windows");
  }

  desktops(): Promise<{ desktops: number[]; activeSpace: number }> {
    return this.read("desktops");
  }

  async prepareDesktops(count: number) {
    await runCommand([this.executable, "prepare-desktops", String(count)], { timeout: 45_000 });
  }

  tree(bundleId: string, depth: number): Promise<AXNode> {
    return this.read("tree", bundleId, String(depth));
  }

  async activate(bundleId: string, ...args: string[]) {
    await runCommand(["/usr/bin/open", "-b", bundleId, ...args]);
    await waitFor(async () => ((await this.front()) === bundleId ? true : undefined), 15_000);
  }

  windows(bundleId: string, depth = 0): Promise<AXNode[]> {
    return this.read("windows", bundleId, String(depth));
  }

  visibleRows(bundleId: string, depth = 0): Promise<AXNode[]> {
    return this.read("visible-rows", bundleId, String(depth));
  }

  async raiseWindow(bundleId: string, identifier: string) {
    await runCommand([this.executable, "raise-window", bundleId, identifier]);
  }

  async closeWindow(bundleId: string, titleOrIdentifier: string) {
    await runCommand([this.executable, "close-window", bundleId, titleOrIdentifier]);
  }

  window(bundleId: string, depth = 0): Promise<AXNode> {
    return this.read("window", bundleId, String(depth));
  }

  async windowElement(
    bundleId: string,
    label: string,
    ...roles: string[]
  ): Promise<AXNode | undefined> {
    return (
      (await this.read<AXNode | null>("window-element", bundleId, label, ...roles)) ?? undefined
    );
  }

  menu(bundleId: string, ...path: string[]): Promise<AXNode> {
    return this.read("menu", bundleId, ...path);
  }

  menuElement(bundleId: string, ...path: string[]): Promise<AXNode> {
    return this.read("menu-element", bundleId, ...path);
  }

  focus(bundleId: string): Promise<AXNode> {
    return this.read("focus", bundleId);
  }

  async press(bundleId: string, ...path: string[]) {
    await runCommand([this.executable, "press", bundleId, ...path]);
  }

  async pressControl(bundleId: string, role: string, label: string) {
    await runCommand([this.executable, "press-control", bundleId, role, label]);
  }

  async selectRow(bundleId: string, label: string) {
    await runCommand([this.executable, "select-row", bundleId, label]);
  }

  async clickControl(bundleId: string, role: string, label: string) {
    await runCommand([this.executable, "click-control", bundleId, role, label]);
  }

  async dragPoints(from: readonly [number, number], to: readonly [number, number]) {
    await runCommand([this.executable, "drag-points", ...[...from, ...to].map(String)]);
  }

  async doubleClickPoint(x: number, y: number) {
    await runCommand([this.executable, "double-click-point", String(x), String(y)]);
  }

  async clickPoint(x: number, y: number) {
    await runCommand([this.executable, "click-point", String(x), String(y)]);
  }

  async key(code: number, flags = 0) {
    await runCommand([this.executable, "key", String(code), String(flags)]);
  }

  async keySequence(codes: readonly number[]) {
    await runCommand([this.executable, "key-sequence", ...codes.map(String)]);
  }

  async scrollAt(x: number, y: number, lines: number) {
    await runCommand([this.executable, "scroll-at", String(x), String(y), String(lines)]);
  }

  async typeText(value: string) {
    await runCommand([this.executable, "type-text", value]);
  }

  async setFocusedText(bundleId: string, value: string) {
    await runCommand([this.executable, "set-focused-text", bundleId, value]);
  }

  async moveIcon(bundleId: string, title: string, x: number, y: number) {
    await runCommand([this.executable, "move", bundleId, title, String(x), String(y)]);
  }
}
