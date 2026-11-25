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

  async nodes(depth = 8) {
    return flattenAX([await this.probe.window(bundleId, depth)]);
  }

  async ready() {
    await this.probe.activate(bundleId);
    await waitFor(async () => {
      const window = await this.probe.window(bundleId, 5);
      if (window.role === "AXSheet" || window.subrole === "AXDialog") {
        const next = flattenAX([window]).find(
          (node) =>
            node.role === "AXButton" &&
            node.enabled &&
            ["Continue", "Get Started"].some((label) => hasLabel(node, label)),
        );
        if (next?.position && next.size) {
          const [x, y] = next.position;
          const [width, height] = next.size;
          await this.probe.clickPoint(x + width / 2, y + height / 2);
        }
        return;
      }
      const newShortcut = await this.probe
        .menu(bundleId, "File", "New Shortcut")
        .catch(() => undefined);
      return (
        (window.role === "AXWindow" &&
          window.subrole === "AXStandardWindow" &&
          ["All Shortcuts", "Gallery"].includes(window.title ?? "") &&
          newShortcut?.enabled) ||
        undefined
      );
    }, 20_000);
  }

  async list() {
    const { stdout } = await runCommand(["/usr/bin/shortcuts", "list"]);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  async readyMenu(...path: string[]) {
    const read = () => this.probe.menu(bundleId, ...path).catch(() => undefined);
    await waitFor(async () => (await read())?.enabled || undefined, 12_000).catch(async (cause) => {
      const state = {
        item: await read(),
        window: await this.probe.window(bundleId),
        focus: await this.probe.focus(bundleId),
      };
      throw new Error(`Shortcuts did not enable ${path.join(" > ")}: ${JSON.stringify(state)}`, {
        cause,
      });
    });
  }

  async selectShortcut(label: string) {
    const { probe } = this;
    await this.restoreLibrary();
    await probe.raiseWindow(bundleId, "All Shortcuts");
    const row = async () => {
      const visible = await probe.visibleRows(bundleId, 8).catch(() => []);
      return [...visible, ...(await this.nodes(10))].find(
        (node) =>
          node.role === "AXRow" &&
          node.position &&
          node.size?.every((amount) => amount > 0) &&
          flattenAX([node]).some((child) => hasLabel(child, label)),
      );
    };
    if (!(await row())) {
      const views = await this.nodes(10);
      const list = views.find(
        (node) =>
          ["AXButton", "AXRadioButton", "AXCheckBox"].includes(node.role ?? "") &&
          node.enabled &&
          node.position &&
          node.size &&
          ["List", "List View", "Show as List"].some((title) => hasLabel(node, title)),
      );
      expect((await probe.window(bundleId)).title).toBe("All Shortcuts");
      expect(await probe.front()).toBe(bundleId);
      if (list?.position && list.size) {
        const [x, y] = list.position;
        const [width, height] = list.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
      } else {
        const search = await probe.windowElement(
          bundleId,
          "AXSearchField",
          "AXSearchField",
          "AXTextField",
        );
        if (!search?.position || !search.size || !views.some(({ id }) => id === "library.grid")) {
          throw new Error("The Shortcuts grid did not expose its list view control");
        }
        // The pinned library's List segment sits 26 points left of the Search field.
        const [x, y] = search.position;
        await probe.clickPoint(x - 26, y + search.size[1] / 2);
      }
    }
    const target = await waitFor(row, 12_000);
    if (!target.selected) {
      const [x, y] = target.position!;
      const [width, height] = target.size!;
      await probe.clickPoint(x + width / 2, y + height / 2);
    }
    if (!(await row())?.selected) await probe.selectRow(bundleId, label);
    await waitFor(async () => (await row())?.selected || undefined, 12_000);
  }

  async editor() {
    return waitFor(async () => {
      const focus = await this.probe.focus(bundleId);
      if (hasLabel(focus, "editor.shortcutname")) return focus;
      return this.probe.windowElement(bundleId, "editor.shortcutname");
    });
  }

  async selectedSection(label: string) {
    await waitFor(async () => {
      const root = await this.probe.window(bundleId);
      if (root.role === "AXWindow" && root.title === label) return root;
      return (await this.nodes()).find(
        (row) =>
          row.role === "AXRow" &&
          row.selected &&
          flattenAX([row]).some((child) => hasLabel(child, label)),
      );
    }, 12_000);
  }

  async restoreLibrary() {
    if ((await this.probe.window(bundleId)).title === "Gallery") {
      await this.probe.press(bundleId, "View", "All Shortcuts");
    }
    await this.selectedSection("All Shortcuts");
  }

  async closeEditor() {
    const editor = await this.probe.window(bundleId);
    if (editor.title && !["Gallery", "All Shortcuts"].includes(editor.title)) {
      await this.probe.closeWindow(bundleId, editor.title);
    }
    await this.selectedSection("All Shortcuts");
  }

  async deleteShortcut(shortcut: string, invoke: () => Promise<void>) {
    if ((await this.probe.front()) !== bundleId) await this.probe.activate(bundleId);
    await this.selectShortcut(shortcut);
    await this.readyMenu("Edit", "Delete");
    const before = await this.list();
    expect(before).toContain(shortcut);
    await invoke();
    await waitFor(async () => {
      const after = await this.list();
      const removed = before.filter((title) => !after.includes(title));
      if (removed.length) {
        expect(removed).toEqual([shortcut]);
        return true;
      }
      const buttons = (await this.nodes()).filter((node) => node.role === "AXButton");
      const confirm = buttons.find(
        (node) => node.title === "Delete" || node.title === "Delete Shortcut",
      );
      if (confirm?.title) await this.probe.pressControl(bundleId, "AXButton", confirm.title);
    }, 12_000);
  }

  async sheet(sequence: string, matches: (node: AXNode) => boolean) {
    const panel = async () => (await this.nodes()).find(matches);
    const dialogCount = async () =>
      (await this.nodes()).filter((node) => node.role === "AXSheet" || node.subrole === "AXDialog")
        .length;
    const before = await dialogCount();
    expect(await panel()).toBeUndefined();
    try {
      await this.app.runChecked(sequence);
      await waitFor(panel, 10_000).catch(async (cause) => {
        const controls = (await this.nodes())
          .filter(({ role }) => role === "AXSheet" || role === "AXButton" || role === "AXHeading")
          .map(({ role, subrole, title, description, id }) => ({
            role,
            subrole,
            title,
            description,
            id,
          }));
        throw new Error(
          `Shortcuts ${sequence} did not open its expected dialog: ${JSON.stringify(controls.slice(0, 30))}`,
          { cause },
        );
      });
    } finally {
      if ((await panel()) || (await dialogCount()) > before) {
        const cancel = await this.probe.windowElement(bundleId, "Cancel", "AXButton");
        if (cancel?.enabled) await this.probe.pressControl(bundleId, "AXButton", "Cancel");
        else await this.probe.key(escape);
        await waitFor(
          async () => (!(await panel()) && (await dialogCount()) === before) || undefined,
        );
      }
    }
  }
}

const cases: Record<string, (shortcuts: Shortcuts) => Promise<void>> = {
  jf: async (shortcuts) => {
    const { app, probe } = shortcuts;
    await shortcuts.selectedSection("All Shortcuts");
    await shortcuts.readyMenu("Edit", "Search");
    const focused = async () => {
      const field = await probe.focus(bundleId);
      return (
        field.subrole === "AXSearchField" ||
        (field.role === "AXTextField" &&
          /search/i.test([field.id, field.title, field.description].filter(Boolean).join(" ")))
      );
    };
    expect(await focused()).toBe(false);
    try {
      await app.runChecked("jf");
      await waitFor(async () => (await focused()) || undefined).catch(async (cause) => {
        throw new Error(
          "Shortcuts did not focus its search field: " +
            JSON.stringify(await probe.focus(bundleId)),
          { cause },
        );
      });
    } finally {
      if (await focused()) await probe.key(escape);
      if (await focused()) await probe.key(48);
      await waitFor(async () => !(await focused()) || undefined);
    }
  },
  fn: async (shortcuts) => {
    await shortcuts.selectedSection("All Shortcuts");
    await shortcuts.readyMenu("File", "New Folder");
    await shortcuts.sheet(
      "fn",
      (node) =>
        (node.role === "AXSheet" || node.subrole === "AXDialog") &&
        flattenAX(node.children ?? []).some((control) => control.role === "AXTextField"),
    );
  },
  ga: async (shortcuts) => {
    await shortcuts.readyMenu("View", "Gallery");
    await shortcuts.probe.press(bundleId, "View", "Gallery");
    try {
      await shortcuts.selectedSection("Gallery");
      await shortcuts.readyMenu("View", "All Shortcuts");
      await shortcuts.app.runChecked("ga");
      await shortcuts.selectedSection("All Shortcuts");
    } finally {
      await shortcuts.restoreLibrary();
    }
  },
  gg: async (shortcuts) => {
    await shortcuts.selectedSection("All Shortcuts");
    try {
      await shortcuts.readyMenu("View", "Gallery");
      await shortcuts.app.runChecked("gg");
      await shortcuts.selectedSection("Gallery");
    } finally {
      await shortcuts.restoreLibrary();
    }
  },
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
  fi: (shortcuts) =>
    shortcuts.sheet("fi", (node) => node.role === "AXButton" && hasLabel(node, "Open")),
  sn: async (shortcuts) => {
    const { app, probe } = shortcuts;
    expect(await shortcuts.list()).not.toContain(name);
    await shortcuts.readyMenu("File", "New Shortcut");
    const before = (await probe.windows(bundleId)).length;
    await app.runChecked("sn");
    try {
      await waitFor(async () => (await probe.windows(bundleId)).length > before || undefined);
      const field = await shortcuts.editor();
      await probe.clickControl(bundleId, field.role!, "editor.shortcutname");
      await probe.key(0, command);
      await probe.typeText(name);
      const named = async () => (await shortcuts.editor()).value === name || undefined;
      if (!(await waitFor(named, 1_500).catch(() => undefined))) {
        const copy = Bun.spawn(["/usr/bin/pbcopy"], { stdin: new Blob([name]) });
        expect(await copy.exited).toBe(0);
        await probe.press(bundleId, "Edit", "Select All");
        await probe.press(bundleId, "Edit", "Paste");
        await waitFor(named);
      }
      await probe.key(36);
    } finally {
      if ((await probe.windows(bundleId)).length > before) await shortcuts.closeEditor();
    }
    await waitFor(async () => (await shortcuts.list()).includes(name) || undefined);
  },
  sd: async (shortcuts) => {
    const { probe } = shortcuts;
    const names = await shortcuts.list();
    await runCommand(["/usr/bin/shortcuts", "view", name]);
    await shortcuts.editor();
    try {
      await probe.raiseWindow(bundleId, name);
      await shortcuts.readyMenu("File", "Duplicate");
      await shortcuts.app.runChecked("sd");
      shortcuts.duplicate = await waitFor(async () => {
        const created = (await shortcuts.list()).filter((title) => !names.includes(title));
        if (created.length === 1) return created[0];
        const editor = await probe.windowElement(bundleId, "editor.shortcutname");
        if (
          typeof editor?.value === "string" &&
          editor.value.includes(name) &&
          editor.value !== name
        ) {
          await shortcuts.closeEditor();
        }
      }, 12_000);
    } finally {
      for (const title of [shortcuts.duplicate, name]) {
        if (title && (await probe.windows(bundleId)).some((window) => window.title === title)) {
          await probe.closeWindow(bundleId, title);
        }
      }
      await shortcuts.selectedSection("All Shortcuts");
    }
  },
  sx: async (shortcuts) => {
    expect(shortcuts.duplicate).not.toBe("");
    await shortcuts.deleteShortcut(name, () => shortcuts.app.runChecked("sx"));
    expect(await shortcuts.list()).toContain(shortcuts.duplicate);
  },
  fe: async (shortcuts) => {
    await runCommand(["/usr/bin/shortcuts", "view", shortcuts.duplicate || name]);
    await shortcuts.editor();
    try {
      await shortcuts.readyMenu("File", "Export…");
      await shortcuts.sheet(
        "fe",
        (node) =>
          (node.role === "AXSheet" || node.subrole === "AXDialog") &&
          flattenAX([node]).some(
            (control) =>
              control.role === "AXButton" &&
              (hasLabel(control, "Export") || hasLabel(control, "Save")),
          ),
      );
    } finally {
      await shortcuts.closeEditor();
    }
  },
  vi: async (shortcuts) => {
    const title = shortcuts.duplicate || name;
    await runCommand(["/usr/bin/shortcuts", "view", title]);
    await shortcuts.editor();
    const details = async () => {
      for (const label of ["Privacy", "Show in Share Sheet"]) {
        const item = await shortcuts.probe.windowElement(bundleId, label);
        if (item?.size?.every((dimension) => dimension > 0)) return item;
      }
    };
    try {
      await shortcuts.probe.raiseWindow(bundleId, title);
      const menu = (label: string) =>
        shortcuts.probe.menu(bundleId, "View", label).catch(() => undefined);
      await waitFor(async () => {
        if ((await menu("Show Shortcut Details"))?.enabled && !(await details())) return true;
        if ((await menu("Show Action Library"))?.enabled) {
          const button = await shortcuts.probe.windowElement(
            bundleId,
            "Show Action Library",
            "AXButton",
          );
          if (button?.enabled && button.position && button.size) {
            const [x, y] = button.position;
            const [width, height] = button.size;
            await shortcuts.probe.clickPoint(x + width / 2, y + height / 2);
          } else {
            await shortcuts.probe.press(bundleId, "View", "Show Action Library");
          }
        }
        await Bun.sleep(500);
      }, 15_000);
      await shortcuts.app.runChecked("vi");
      await waitFor(details, 12_000).catch(async (cause) => {
        const items = (await shortcuts.nodes(8))
          .map(({ role, title, description, id }) => ({ role, title, description, id }))
          .filter(({ title, description, id }) => title || description || id);
        throw new Error(
          "Shortcuts details was not visible: " + JSON.stringify(items.slice(0, 35)),
          { cause },
        );
      });
    } finally {
      await shortcuts.closeEditor();
    }
  },
  va: async (shortcuts) => {
    await runCommand(["/usr/bin/shortcuts", "view", shortcuts.duplicate || name]);
    await shortcuts.editor();
    const search = async () =>
      shortcuts.probe.windowElement(bundleId, "AXSearchField", "AXTextField");
    try {
      await shortcuts.probe.press(bundleId, "View", "Show Shortcut Details");
      await waitFor(async () => ((await search()) ? undefined : true));
      await shortcuts.readyMenu("View", "Show Action Library");
      await shortcuts.app.runChecked("va");
      await waitFor(search);
    } finally {
      await shortcuts.closeEditor();
    }
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
              await shortcuts.ready();
              await run(shortcuts);
              console.log(`Shortcuts ${sequence} passed`);
            } catch (error) {
              const failure = `Shortcuts ${sequence}: ${error}`;
              console.error(failure);
              failures.push(failure);
            }
          }
        } finally {
          for (const title of [shortcuts.duplicate, name]) {
            if (title && (await shortcuts.list()).includes(title)) {
              await shortcuts
                .deleteShortcut(title, () => probe.press(bundleId, "Edit", "Delete"))
                .catch((error: unknown) =>
                  failures.push(`Shortcuts could not remove ${title}: ${error}`),
                );
            }
          }
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  240_000,
);
