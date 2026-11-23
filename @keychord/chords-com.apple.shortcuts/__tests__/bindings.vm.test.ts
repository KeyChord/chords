import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.shortcuts";
const command = 1 << 20;
const escape = 53;
const name = "Chordtest shortcut";
const hasLabel = (node: AXNode, label: string) =>
  [node.title, node.description, node.value, node.id].includes(label);

class Shortcuts {
  duplicate = "";

  constructor(
    readonly app: ChordApp,
    readonly probe: MacOSProbe,
  ) {}

  async nodes() {
    return flattenAX([await this.probe.window(bundleId, 10)]);
  }

  async ready() {
    await this.probe.activate(bundleId);
    await waitFor(async () => {
      const nodes = await this.nodes();
      if (nodes.some((node) => hasLabel(node, "All Shortcuts"))) return true;
      const button = nodes.find(
        (node) =>
          node.role === "AXButton" &&
          node.enabled &&
          ["Continue", "Get Started"].includes(node.title ?? ""),
      );
      if (button?.title) await this.probe.pressControl(bundleId, "AXButton", button.title);
    }, 15_000);
  }

  async list() {
    const { stdout } = await runCommand(["/usr/bin/shortcuts", "list"]);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async find(label: string) {
    return waitFor(async () => (await this.nodes()).find((node) => hasLabel(node, label)));
  }

  async click(label: string) {
    const node = await this.find(label);
    await this.probe.clickControl(bundleId, node.role!, label);
  }

  async editor() {
    return this.find("editor.shortcutname");
  }

  async selectedSection(label: string) {
    await waitFor(async () =>
      (await this.nodes()).find((node) => hasLabel(node, label) && node.selected),
    );
  }

  async closeEditor() {
    await this.probe.key(13, command);
    await this.find("All Shortcuts");
  }

  async deleteShortcut(shortcut: string, invoke: () => Promise<void>) {
    await this.click(shortcut);
    await invoke();
    await waitFor(async () => {
      if (!(await this.list()).includes(shortcut)) return true;
      const buttons = (await this.nodes()).filter((node) => node.role === "AXButton");
      const confirm = buttons.find(
        (node) => node.title === "Delete" || node.title === "Delete Shortcut",
      );
      if (confirm?.title) await this.probe.pressControl(bundleId, "AXButton", confirm.title);
    });
  }

  async sheet(sequence: string, matches: (node: AXNode) => boolean) {
    const panel = async () => (await this.nodes()).find(matches);
    expect(await panel()).toBeUndefined();
    try {
      await this.app.runChecked(sequence);
      await waitFor(panel);
    } finally {
      await this.probe.key(escape);
      await waitFor(async () => ((await panel()) ? undefined : true));
    }
  }
}

const cases: Record<string, (shortcuts: Shortcuts) => Promise<void>> = {
  vs: async ({ app, probe }) => {
    const item = async () =>
      flattenAX([await probe.menu(bundleId, "View")]).find((node) =>
        /^(Show|Hide) Sidebar$/.test(node.title ?? ""),
      )?.title;
    const before = await item();
    expect(before).toMatch(/^(Show|Hide) Sidebar$/);
    const after = before === "Show Sidebar" ? "Hide Sidebar" : "Show Sidebar";
    await app.runChecked("vs");
    try {
      await waitFor(async () => (await item()) === after || undefined);
    } finally {
      if ((await item()) === after) await app.runChecked("vs");
      await waitFor(async () => (await item()) === before || undefined);
    }
  },
  ga: async (shortcuts) => {
    await shortcuts.probe.press(bundleId, "View", "Gallery");
    await shortcuts.selectedSection("Gallery");
    await shortcuts.app.runChecked("ga");
    await shortcuts.selectedSection("All Shortcuts");
  },
  gg: async (shortcuts) => {
    await shortcuts.probe.press(bundleId, "View", "All Shortcuts");
    await shortcuts.selectedSection("All Shortcuts");
    try {
      await shortcuts.app.runChecked("gg");
      await shortcuts.selectedSection("Gallery");
    } finally {
      await shortcuts.probe.press(bundleId, "View", "All Shortcuts");
      await shortcuts.selectedSection("All Shortcuts");
    }
  },
  jf: async ({ app, probe }) => {
    const focused = async () => (await probe.focus(bundleId)).subrole === "AXSearchField";
    expect(await focused()).toBe(false);
    try {
      await app.runChecked("jf");
      await waitFor(async () => (await focused()) || undefined);
    } finally {
      await probe.key(escape);
      await probe.key(48);
      await waitFor(async () => !(await focused()) || undefined);
    }
  },
  fn: (shortcuts) =>
    shortcuts.sheet(
      "fn",
      (node) =>
        node.role === "AXTextField" &&
        ["New Folder", "Folder Name", "Name"].some((label) => hasLabel(node, label)),
    ),
  fi: (shortcuts) =>
    shortcuts.sheet("fi", (node) => node.role === "AXButton" && hasLabel(node, "Open")),
  sn: async (shortcuts) => {
    const { app, probe } = shortcuts;
    expect(await shortcuts.list()).not.toContain(name);
    const before = (await probe.windows(bundleId)).length;
    await app.runChecked("sn");
    try {
      await waitFor(async () => (await probe.windows(bundleId)).length > before || undefined);
      const field = await shortcuts.editor();
      await probe.clickControl(bundleId, field.role!, "editor.shortcutname");
      const copy = Bun.spawn(["/usr/bin/pbcopy"], { stdin: new Blob([name]) });
      expect(await copy.exited).toBe(0);
      await probe.key(0, command);
      await probe.key(9, command);
      await probe.key(36);
      await waitFor(async () => (await shortcuts.editor()).value === name || undefined);
    } finally {
      if ((await probe.windows(bundleId)).length > before) await shortcuts.closeEditor();
    }
    await waitFor(async () => (await shortcuts.list()).includes(name) || undefined);
  },
  vi: async (shortcuts) => {
    await runCommand(["/usr/bin/shortcuts", "view", name]);
    await shortcuts.editor();
    const details = async () =>
      (await shortcuts.nodes()).find(
        (node) =>
          hasLabel(node, "Privacy") &&
          ["AXRadioButton", "AXButton", "AXTab"].includes(node.role ?? ""),
      );
    try {
      await shortcuts.probe.press(bundleId, "View", "Show Action Library");
      await waitFor(async () => ((await details()) ? undefined : true));
      await shortcuts.app.runChecked("vi");
      await waitFor(details);
    } finally {
      await shortcuts.closeEditor();
    }
  },
  va: async (shortcuts) => {
    await runCommand(["/usr/bin/shortcuts", "view", name]);
    await shortcuts.editor();
    const search = async () =>
      (await shortcuts.nodes()).find((node) => node.subrole === "AXSearchField");
    try {
      await shortcuts.probe.press(bundleId, "View", "Show Shortcut Details");
      await waitFor(async () => ((await search()) ? undefined : true));
      await shortcuts.app.runChecked("va");
      await waitFor(search);
    } finally {
      await shortcuts.closeEditor();
    }
  },
  fe: async (shortcuts) => {
    await shortcuts.click(name);
    await shortcuts.sheet("fe", (node) => node.role === "AXButton" && hasLabel(node, "Export"));
  },
  sd: async (shortcuts) => {
    await shortcuts.click(name);
    const names = await shortcuts.list();
    await shortcuts.app.runChecked("sd");
    shortcuts.duplicate = await waitFor(async () =>
      (await shortcuts.list()).find((title) => title.startsWith(name) && !names.includes(title)),
    );
  },
  sx: async (shortcuts) => {
    expect(shortcuts.duplicate).not.toBe("");
    await shortcuts.deleteShortcut(shortcuts.duplicate, () => shortcuts.app.runChecked("sx"));
    expect(await shortcuts.list()).toContain(name);
    shortcuts.duplicate = "";
  },
};

test("every Shortcuts binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/shortcuts/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Shortcuts chords manage a local shortcut and switch its editor panes",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const shortcuts = new Shortcuts(app, probe);
        await shortcuts.ready();
        const failures: string[] = [];
        try {
          for (const [sequence, run] of Object.entries(cases)) {
            try {
              await run(shortcuts);
              console.log(`Shortcuts ${sequence} passed`);
            } catch (error) {
              failures.push(`Shortcuts ${sequence}: ${error}`);
            }
          }
        } finally {
          for (const title of [shortcuts.duplicate, name]) {
            if (title && (await shortcuts.list()).includes(title)) {
              await shortcuts.deleteShortcut(title, () => probe.press(bundleId, "Edit", "Delete"));
            }
          }
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  240_000,
);
