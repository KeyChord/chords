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
const command = 1 << 20;
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
      if (
        nodes.some((node) => label(node, "All Entries")) &&
        (await this.probe.menu(bundleId, "File", "New Entry")).enabled
      )
        return true;
      const button = ["Continue", "Get Started", "Not Now", "Not now", "Skip"].find((text) =>
        nodes.some((node) => node.role === "AXButton" && node.enabled && label(node, text)),
      );
      if (button) await this.probe.pressControl(bundleId, "AXButton", button);
    }, 20_000);
  }

  async editor() {
    return waitFor(async () => {
      const node = await this.probe.focus(bundleId);
      return node.role === "AXTextArea" ? node : undefined;
    });
  }

  async entry() {
    return waitFor(async () =>
      (await this.nodes()).find((node) => label(node, entryText) && node.role !== "AXTextArea"),
    );
  }

  async selectEntry() {
    const entry = await this.entry();
    const name = entry.title ?? entry.description ?? String(entry.value);
    await this.probe.clickControl(bundleId, entry.role!, name);
  }

  async closeDialog() {
    await this.probe.key(escape);
    await waitFor(async () =>
      (await this.nodes()).some((node) => node.role === "AXSheet") ? undefined : true,
    );
  }

  async section(name: string) {
    await waitFor(async () =>
      (await this.nodes()).find(
        (node) =>
          label(node, name) &&
          (node.selected === true ||
            (["AXRadioButton", "AXCheckBox"].includes(node.role ?? "") && node.value === 1)),
      ),
    );
  }

  async panel(sequence: string, expression: RegExp) {
    const shown = async () =>
      (await this.nodes()).find((node) =>
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
    await journal.editor();
    for (const code of [8, 4, 31, 15, 2]) await probe.key(code); // chord
    await waitFor(async () => (await probe.focus(bundleId)).value === entryText || undefined);
    await probe.pressControl(bundleId, "AXButton", "Done");
    await journal.entry();
  },
  nj: (journal) => journal.panel("nj", /^New Journal$/),
  nw: async ({ app, probe }) => {
    const count = (await probe.windows(bundleId)).length;
    try {
      await app.runChecked("nw");
      await waitFor(async () => (await probe.windows(bundleId)).length === count + 1 || undefined);
    } finally {
      if ((await probe.windows(bundleId)).length > count) await probe.key(13, command);
    }
    await waitFor(async () => (await probe.windows(bundleId)).length === count || undefined);
  },
  jf: async ({ app, probe }) => {
    const focused = async () => (await probe.focus(bundleId)).subrole === "AXSearchField";
    expect(await focused()).toBe(false);
    try {
      await app.runChecked("jf");
      await waitFor(async () => (await focused()) || undefined);
    } finally {
      await probe.key(escape);
      await waitFor(async () => !(await focused()) || undefined);
    }
  },
  "s,": async (journal) => {
    const { app, probe } = journal;
    const settings = async () =>
      (await probe.windows(bundleId)).find((node) =>
        /^(Journal )?Settings$/.test(node.title ?? ""),
      );
    expect(await settings()).toBeUndefined();
    try {
      await app.runChecked("s,");
      await waitFor(settings);
    } finally {
      if (await settings()) await probe.key(13, command);
      await waitFor(async () => ((await settings()) ? undefined : true));
    }
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
  fp: (journal) => journal.panel("fp", /^Print Options$/),
  gd: async (journal) => {
    await journal.app.runChecked("gd");
    try {
      await journal.section("Recently Deleted");
    } finally {
      await journal.probe.press(bundleId, "View", "All Entries");
      await journal.section("All Entries");
    }
  },
  ga: async (journal) => {
    await journal.probe.press(bundleId, "View", "Recently Deleted");
    await journal.section("Recently Deleted");
    await journal.app.runChecked("ga");
    await journal.section("All Entries");
  },
  ex: async (journal) => {
    await journal.selectEntry();
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
    await journal.probe.pressControl(bundleId, "AXButton", confirm.title ?? "Delete Entry");
    await waitFor(async () =>
      (await journal.nodes()).some((node) => label(node, entryText)) ? undefined : true,
    );
    await journal.probe.press(bundleId, "View", "Recently Deleted");
    await journal.entry();
    await journal.probe.press(bundleId, "View", "All Entries");
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
