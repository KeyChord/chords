import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type AXNode,
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.journal";
const entryText = "chord";
const escape = 53;
const label = (node: AXNode, text: string) =>
  [node.title, node.description, node.value].includes(text);

class Journal {
  constructor(
    readonly app: ChordApp,
    readonly probe: MacOSProbe,
  ) {}

  async nodes() {
    return flattenAX(await this.probe.windows(bundleId, 10));
  }

  async ready() {
    await this.probe.activate(bundleId);
    await waitFor(async () => {
      const nodes = await this.nodes();
      const button = nodes.find(
        (node) =>
          node.role === "AXButton" &&
          node.enabled &&
          ["Continue", "Get Started", "Not Now", "Not now", "Skip"].some((text) =>
            label(node, text),
          ),
      );
      if (button?.position && button.size) {
        await this.probe.clickPoint(
          button.position[0] + button.size[0] / 2,
          button.position[1] + button.size[1] / 2,
        );
        return;
      }
      const window = (await this.probe.windows(bundleId)).find(({ title }) =>
        title?.startsWith("Journal"),
      );
      return window &&
        (await this.probe.menu(bundleId, "File", "New Entry").catch(() => undefined))?.enabled
        ? true
        : undefined;
    }, 20_000);
  }

  async editor() {
    const field = await waitFor(async () => {
      const nodes = await this.nodes();
      const onboarding = nodes.find(
        (node) =>
          node.role === "AXSheet" &&
          flattenAX([node]).some(
            ({ role, description }) => role === "AXHeading" && description === "Welcome to",
          ),
      );
      if (onboarding) {
        const next = flattenAX([onboarding]).find(
          (node) => node.role === "AXButton" && label(node, "Continue") && node.enabled !== false,
        );
        if (next?.position && next.size) {
          const [x, y] = next.position;
          const [width, height] = next.size;
          await this.probe.clickPoint(x + width / 2, y + height / 2);
        }
        return;
      }
      return nodes.find(
        ({ role, description, position, size }) =>
          role === "AXTextArea" && description === "Journal Text" && position && size,
      );
    }, 12_000);
    const focused = await this.probe.focus(bundleId);
    if (focused.role !== "AXTextArea" || focused.description !== "Journal Text") {
      await this.probe.clickPoint(
        field.position![0] + field.size![0] / 2,
        field.position![1] + field.size![1] / 2,
      );
    }
    return waitFor(async () => {
      const node = await this.probe.focus(bundleId);
      return node.role === "AXTextArea" && node.description === "Journal Text" ? node : undefined;
    });
  }

  async entry() {
    return waitFor(async () => {
      const nodes = await this.nodes();
      if (nodes.some((node) => node.role === "AXButton" && label(node, "Done"))) return;
      return nodes.find((node) => label(node, entryText) && node.position && node.size);
    }).catch(async (cause) => {
      const visible = (await this.nodes()).filter(({ role }) =>
        ["AXStaticText", "AXHeading", "AXTextField", "AXTextArea"].includes(role ?? ""),
      );
      throw new Error("Saved entry did not appear: " + JSON.stringify(visible), { cause });
    });
  }

  async selectEntry(path = ["Entry", "Edit Entry"]) {
    const entry = await this.entry();
    const actionEnabled = async () =>
      (await this.probe.menu(bundleId, ...path)).enabled || undefined;
    if (await actionEnabled()) return;
    await this.probe.selectRow(bundleId, entryText).catch(() => {});
    if (await actionEnabled()) return;
    const cell =
      (await this.nodes())
        .filter(
          (node) =>
            ["AXRow", "AXCell", "AXButton", "AXGroup"].includes(node.role ?? "") &&
            node.position &&
            node.size?.every((dimension) => dimension > 0) &&
            flattenAX([node]).some((child) => label(child, entryText)),
        )
        .sort((a, b) => a.size![0] * a.size![1] - b.size![0] * b.size![1])[0] ?? entry;
    const [x, y] = cell.position!;
    const [width, height] = cell.size!;
    await this.probe.clickPoint(x + width / 2, y + height / 2);
    await waitFor(actionEnabled, 8_000).catch(async (cause) => {
      throw new Error(
        "The saved Journal entry did not enable " +
          path.join(" > ") +
          ": " +
          JSON.stringify({
            row: { role: cell.role, id: cell.id, position: cell.position, size: cell.size },
            focus: await this.probe.focus(bundleId),
            controls: (await this.nodes())
              .filter((node) => node.role === "AXButton" || label(node, entryText))
              .map(({ role, title, description, id, position, size }) => ({
                role,
                title,
                description,
                id,
                position,
                size,
              }))
              .slice(0, 30),
          }),
        { cause },
      );
    });
  }

  async closeDialog() {
    const cancel = (await this.nodes()).find(
      (node) => node.role === "AXButton" && node.enabled && label(node, "Cancel"),
    );
    if (cancel?.position && cancel.size) {
      const [x, y] = cancel.position;
      const [width, height] = cancel.size;
      await this.probe.clickPoint(x + width / 2, y + height / 2);
    } else {
      await this.probe.key(escape);
    }
    await waitFor(async () =>
      (await this.nodes()).some((node) => node.role === "AXSheet") ? undefined : true,
    );
  }

  async entryList() {
    const back = await this.probe.windowElement(bundleId, "BackButton", "AXButton");
    if (back?.enabled && back.position && back.size) {
      const [x, y] = back.position;
      const [width, height] = back.size;
      await this.probe.clickPoint(x + width / 2, y + height / 2);
      await waitFor(
        async () =>
          !(await this.probe.windowElement(bundleId, "BackButton", "AXButton")) || undefined,
      );
    }
    return this.entry();
  }

  async section(name: string) {
    const selected = (node: AXNode) =>
      node.selected === true ||
      (["AXRadioButton", "AXCheckBox"].includes(node.role ?? "") && node.value === 1);
    await waitFor(async () => {
      const menu = await this.probe.menu(bundleId, "View", name).catch(() => undefined);
      if (menu?.mark) return true;
      return (await this.nodes()).find((node) => label(node, name) && selected(node));
    });
  }

  async selectSection(name: string) {
    const target = await waitFor(async () =>
      (await this.nodes()).find(
        (node) =>
          node.role === "AXStaticText" &&
          node.description === name &&
          node.enabled &&
          node.position &&
          node.size?.every((dimension) => dimension > 0),
      ),
    );
    const [x, y] = target.position!;
    const [width, height] = target.size!;
    await this.probe.clickPoint(x + width / 2, y + height / 2);
    await this.section(name);
  }

  async panel(sequence: string, expression: RegExp) {
    const shown = async () =>
      (await this.nodes()).find(
        (node) =>
          node.role !== "AXButton" &&
          [node.title, node.description, node.value].some(
            (value) => typeof value === "string" && expression.test(value),
          ),
      );
    expect(await shown()).toBeUndefined();
    try {
      await this.app.runChecked(sequence);
      await waitFor(shown);
    } finally {
      await this.closeDialog();
      await waitFor(async () => ((await shown()) ? undefined : true));
    }
  }
}

const cases: Record<string, (journal: Journal) => Promise<void>> = {
  ne: async (journal) => {
    const { app, probe } = journal;
    expect((await probe.focus(bundleId)).role).not.toBe("AXTextArea");
    await app.runChecked("ne");
    await journal.editor().catch((cause) => {
      throw new Error("Journal text editor did not receive focus", { cause });
    });
    const typed = async () => (await probe.focus(bundleId)).value === entryText || undefined;
    await probe.typeText(entryText);
    if (!(await waitFor(typed, 1_500).catch(() => undefined))) {
      const copy = Bun.spawn(["/usr/bin/pbcopy"], { stdin: new Blob([entryText]) });
      expect(await copy.exited).toBe(0);
      if ((await probe.focus(bundleId)).value) await probe.press(bundleId, "Edit", "Select All");
      await probe.press(bundleId, "Edit", "Paste");
    }
    await waitFor(typed).catch(async (cause) => {
      throw new Error(
        "Entry text did not reach the editor: " + JSON.stringify(await probe.focus(bundleId)),
        { cause },
      );
    });
    await probe.pressControl(bundleId, "AXButton", "Done");
    await journal.entry();
  },
  "s,": async ({ app, probe }) => {
    const identify = ({ title, id, position }: AXNode) => JSON.stringify([title, id, position]);
    const openedBefore = await probe.windows(bundleId);
    const known = openedBefore.map(identify);
    const settings = async () => {
      const current = await probe.windows(bundleId, 6);
      return current.find((window) => {
        if (known.includes(identify(window))) return false;
        const items = flattenAX([window]);
        return (
          /^(Journal )?Settings$/.test(window.title ?? "") ||
          ["General", "Notifications"].every((heading) =>
            items.some((item) => item.role === "AXButton" && label(item, heading)),
          )
        );
      });
    };
    await app.runChecked("s,");
    const opened = await waitFor(settings, 10_000).catch(async (cause) => {
      throw new Error(
        "Journal did not show Settings: " + JSON.stringify(await probe.windows(bundleId)),
        { cause },
      );
    });
    const identifier = opened.title ?? opened.id;
    expect(identifier).toBeTruthy();
    await probe.closeWindow(bundleId, identifier!);
    await waitFor(async () => !(await settings()) || undefined);
    const main = openedBefore.find((window) => window.title?.startsWith("Journal"));
    if (main?.title) await probe.raiseWindow(bundleId, main.title);
  },
  ee: async (journal) => {
    await journal.selectEntry();
    await journal.app.runChecked("ee");
    expect((await journal.editor()).value).toBe(entryText);
    await journal.probe.pressControl(bundleId, "AXButton", "Done");
    await journal.entry();
  },
  eb: async (journal) => {
    await journal.selectEntry();
    const bookmark = async () =>
      flattenAX([await journal.probe.menu(bundleId, "Entry")]).find((node) =>
        ["Add Bookmark", "Remove Bookmark"].includes(node.title ?? ""),
      )?.title;
    expect(await bookmark()).toBe("Add Bookmark");
    await journal.app.runChecked("eb");
    try {
      await waitFor(async () => (await bookmark()) === "Remove Bookmark" || undefined);
    } finally {
      await journal.app.runChecked("eb");
      await waitFor(async () => (await bookmark()) === "Add Bookmark" || undefined);
    }
  },
  fe: (journal) => journal.panel("fe", /^Export Journal Entries\?$/),
  jf: async ({ app, probe }) => {
    const searchItem = await probe.menu(bundleId, "Edit", "Find", "Search");
    if (searchItem.enabled === false) {
      await app.expectFailure("jf", /Menu item "Search".*is disabled/);
      return;
    }
    const focused = async () => {
      const field = await probe.focus(bundleId);
      return (
        field.subrole === "AXSearchField" ||
        (field.role === "AXTextField" &&
          [field.title, field.description, field.id].some((name) => /search/i.test(name ?? "")))
      );
    };
    expect(await focused()).toBe(false);
    try {
      await app.runChecked("jf");
      await waitFor(async () => (await focused()) || undefined);
    } finally {
      await probe.key(escape);
      if (await focused()) await probe.key(48);
      await waitFor(async () => !(await focused()) || undefined);
    }
  },
  fp: async (journal) => {
    await journal.entryList();
    await journal.panel("fp", /^Print Options$/);
  },
  ex: async (journal) => {
    await journal.entryList();
    await journal.app.runChecked("ex");
    const confirm = await waitFor(async () => {
      const nodes = await journal.nodes();
      const deleteLabel = nodes.find(
        (node) => node.role === "AXButton" && label(node, "Delete Entry"),
      );
      if (deleteLabel) return deleteLabel;
      return nodes.some((node) => label(node, "Delete Entry?"))
        ? nodes.find((node) => node.role === "AXButton" && label(node, "Delete"))
        : undefined;
    });
    await journal.probe.pressControl(
      bundleId,
      "AXButton",
      confirm.title ?? confirm.description ?? "Delete Entry",
    );
    await waitFor(async () =>
      (await journal.nodes()).some((node) => label(node, entryText)) ? undefined : true,
    );
    await waitFor(async () =>
      (await journal.nodes()).find(
        (node) =>
          node.role === "AXStaticText" &&
          node.description === "Recently Deleted" &&
          node.value === "1 entry",
      ),
    );
  },
  gd: async (journal) => {
    await journal.app.runChecked("gd");
    try {
      await journal.section("Recently Deleted");
      await journal.entry();
    } finally {
      await journal.selectSection("Journal");
    }
  },
  ga: async (journal) => {
    await journal.app.runChecked("gd");
    await journal.section("Recently Deleted");
    await journal.entry();
    await journal.app.runChecked("ga");
    // Retain the deleted record in the fixture and verify the regular empty list.
    await waitFor(async () => {
      const nodes = await journal.nodes();
      return (
        (!nodes.some((node) => label(node, entryText)) &&
          ["No Entries", "To add an entry, click the plus button."].every((title) =>
            nodes.some((node) => node.role === "AXStaticText" && label(node, title)),
          )) ||
        undefined
      );
    }, 10_000).catch(async (cause) => {
      const labels = (await journal.nodes())
        .filter(({ role }) => role === "AXHeading" || role === "AXStaticText")
        .map(({ title, description, value }) => title ?? description ?? value);
      throw new Error(
        "Journal did not return to the regular entry list: " + JSON.stringify(labels),
        {
          cause,
        },
      );
    });
  },
  nj: (journal) => journal.panel("nj", /^Journal Name$/),
  nw: async ({ app, probe }) => {
    const scenes = async () =>
      (await probe.windows(bundleId)).filter(
        ({ id, subrole }) => id === "SceneWindow" && subrole === "AXStandardWindow",
      );
    const identify = ({ title, position }: AXNode) => JSON.stringify([title, position]);
    const original = (await scenes()).map(identify);
    expect(original.length).toBeGreaterThan(0);
    await app.runChecked("nw");
    const opened = await waitFor(async () => {
      const current = await scenes();
      if (current.length !== original.length + 1) return;
      return current.find((window) => !original.includes(identify(window)));
    }, 12_000);
    if (
      opened.title &&
      (await scenes()).filter(({ title }) => title === opened.title).length === 1
    ) {
      await probe.closeWindow(bundleId, opened.title);
    } else {
      const focused = await probe.window(bundleId);
      expect(identify(focused)).toBe(identify(opened));
      await probe.press(bundleId, "File", "Close");
    }
    await waitFor(async () => (await scenes()).length === original.length || undefined);
  },
};

test("every Journal binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/journal/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Journal chords manage a local entry and switch the app's views",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const journal = new Journal(app, probe);
        await journal.ready();
        const failures: string[] = [];
        for (const [sequence, run] of Object.entries(cases)) {
          try {
            if ((await probe.front()) !== bundleId) await probe.activate(bundleId);
            await run(journal);
            console.log(`Journal ${sequence} passed`);
          } catch (error) {
            failures.push(`Journal ${sequence}: ${error}`);
          }
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  240_000,
);
