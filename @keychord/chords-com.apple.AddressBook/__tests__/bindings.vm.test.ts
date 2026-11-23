import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const bundleId = "com.apple.AddressBook";

type Scenario = {
  keys: string[];
  run: (app: ChordApp, probe: MacOSProbe) => Promise<void>;
};

async function until(check: () => Promise<boolean>, state: string) {
  await waitFor(async () => ((await check()) ? true : undefined), 10_000).catch((cause) => {
    throw new Error("Expected " + state, { cause });
  });
}

async function nodes(probe: MacOSProbe) {
  return flattenAX(await probe.windows(bundleId, 8));
}

const first = "Pim";
const second = "Pimx";
const menu = (probe: MacOSProbe, ...path: string[]) => probe.menu(bundleId, ...path);
const press = (probe: MacOSProbe, ...path: string[]) => probe.press(bundleId, ...path);

async function listsTitle(probe: MacOSProbe) {
  return flattenAX([await menu(probe, "View")]).find((node) =>
    /^(Show|Hide) Lists$/.test(node.title ?? ""),
  )?.title;
}

async function prepare(probe: MacOSProbe) {
  if (
    (await nodes(probe)).some(({ title, value }) =>
      [title, value].some(
        (text) =>
          typeof text === "string" && /Welcome to Contacts|What’s New in Contacts/i.test(text),
      ),
    )
  ) {
    await probe.pressControl(bundleId, "AXButton", "Continue");
  }
  await until(
    async () => (await menu(probe, "File", "New Card")).enabled === true,
    "the contacts list",
  );
}

const files = {
  fi: /^(Import|Open)$/,
  xa: /^(Save|Export)$/,
};

const scenarios: Record<string, Scenario> = {
  "creates, edits, navigates, opens, exports and deletes local contacts": {
    keys: ["nc", "ee", "g[", "g]", "vw", "xc", "ex"],
    async run(app, probe) {
      const row = (name: string) => async () =>
        (await nodes(probe)).find(
          (node) =>
            node.role === "AXRow" &&
            flattenAX(node.children ?? []).some((child) =>
              [child.title, child.value].includes(name),
            ),
        );
      const edit = async () =>
        (await nodes(probe)).some((node) => node.role === "AXButton" && node.title === "Done");
      const selected = async (name: string) => (await row(name)())?.selected === true;
      const nameCard = async (name: string) => {
        await until(edit, "the contact editor");
        await until(
          async () => (await probe.focus(bundleId)).role === "AXTextField",
          "the new card name field",
        );
        await probe.key(35, 1 << 17);
        await probe.key(34);
        await probe.key(46);
        if (name === second) await probe.key(7);
        await probe.pressControl(bundleId, "AXButton", "Done");
        await waitFor(row(name), 10_000);
      };
      const confirmDelete = async () => {
        const confirm = (await nodes(probe)).some(
          (node) => node.role === "AXButton" && node.title === "Delete",
        );
        if (confirm) await probe.pressControl(bundleId, "AXButton", "Delete");
      };
      expect(await row(first)()).toBeUndefined();
      expect(await row(second)()).toBeUndefined();
      try {
        await app.runChecked("nc");
        await nameCard(first);
        expect(await edit()).toBe(false);

        await app.runChecked("ee");
        await until(edit, "the selected card's editor");
        await probe.pressControl(bundleId, "AXButton", "Done");
        await until(async () => !(await edit()), "the card editor to close");

        await press(probe, "File", "New Card");
        await nameCard(second);
        await until(() => selected(second), "the second fixture contact to be selected");
        await app.runChecked("g[");
        await until(() => selected(first), "the previous card to become selected");
        await app.runChecked("g]");
        await until(() => selected(second), "the next card to become selected");

        const windows = (await probe.windows(bundleId)).length;
        await app.runChecked("vw");
        await until(
          async () => (await probe.windows(bundleId)).length === windows + 1,
          "a separate contact window",
        );
        await probe.key(13, 1 << 20);
        await until(
          async () => (await probe.windows(bundleId)).length === windows,
          "the separate contact window to close",
        );

        const save = async () =>
          (await nodes(probe)).some(
            (node) => node.role === "AXButton" && /^(Save|Export)$/.test(node.title ?? ""),
          );
        await app.runChecked("xc");
        await until(save, "the vCard save panel");
        await probe.key(53);
        await until(async () => !(await save()), "the vCard save panel to close");

        await app.runChecked("ex");
        await confirmDelete();
        await until(async () => !(await row(second)()), "the selected contact to be deleted");
      } finally {
        await probe.key(53);
        for (const name of [first, second]) {
          if (!(await row(name)())) continue;
          await probe.selectRow(bundleId, name);
          await press(probe, "Edit", "Delete");
          await confirmDelete();
          await until(async () => !(await row(name)()), "fixture contact cleanup");
        }
      }
    },
  },
  "creates a list and opens the smart list composer": {
    keys: ["nl", "ns"],
    async run(app, probe) {
      const original = await waitFor(() => listsTitle(probe));
      if (original.startsWith("Show ")) await press(probe, "View", original);
      const isNewList = async () => {
        const focused = await probe.focus(bundleId);
        return (
          focused.role === "AXTextField" &&
          /untitled|new list/i.test(String(focused.value ?? focused.title ?? ""))
        );
      };
      try {
        expect(await isNewList()).toBe(false);
        await app.runChecked("nl");
        await until(isNewList, "the new list name editor");
        await probe.key(53);
        await press(probe, "Edit", "Undo");
        await until(async () => !(await isNewList()), "the new list editor to close");

        const composer = async () =>
          (await nodes(probe)).some((node) => node.role === "AXButton" && node.title === "Cancel");
        expect(await composer()).toBe(false);
        await app.runChecked("ns");
        await until(composer, "the smart list composer");
        await probe.key(53);
        await until(async () => !(await composer()), "the smart list composer to close");
      } finally {
        await probe.key(53);
        const current = await listsTitle(probe);
        if (current && original !== current) await press(probe, "View", current);
      }
    },
  },
  "toggles lists and focuses contact search": {
    keys: ["vl", "jc"],
    async run(app, probe) {
      const title = () => listsTitle(probe);
      const original = await waitFor(title);
      const changed = original === "Show Lists" ? "Hide Lists" : "Show Lists";
      await app.runChecked("vl");
      try {
        await until(async () => (await title()) === changed, changed);
      } finally {
        if ((await title()) === changed) await app.runChecked("vl");
      }
      await until(async () => (await title()) === original, original);

      const focused = async () => (await probe.focus(bundleId)).subrole === "AXSearchField";
      expect(await focused()).toBe(false);
      await app.runChecked("jc");
      try {
        await until(focused, "the contact search field");
      } finally {
        await probe.key(53);
      }
    },
  },
  "opens the import and Contacts archive panels": {
    keys: Object.keys(files),
    async run(app, probe) {
      for (const [key, button] of Object.entries(files)) {
        const panel = async () =>
          (await nodes(probe)).some(
            (node) => node.role === "AXButton" && button.test(node.title ?? ""),
          );
        expect(await panel()).toBe(false);
        await app.runChecked(key);
        try {
          await until(panel, "the file panel for " + key);
        } finally {
          await probe.key(53);
        }
        await until(async () => !(await panel()), "the file panel to close");
      }
    },
  },
};

test("every Contacts binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/AddressBook/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(
    Object.values(scenarios)
      .flatMap(({ keys }) => keys)
      .sort(),
  );
});

for (const [name, { run }] of Object.entries(scenarios)) {
  test.skipIf(!macOSUITestsEnabled)(
    "Contacts " + name,
    async () => {
      console.log(
        "guest macOS",
        Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
      );
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(bundleId);
          await until(async () => (await probe.windows(bundleId)).length > 0, "the main window");
          try {
            await prepare(probe);
            await run(app, probe);
          } catch (cause) {
            console.error(
              "Contacts windows",
              JSON.stringify(await probe.windows(bundleId, 5).catch(() => [])).slice(0, 6_000),
            );
            throw cause;
          }
        }),
      );
    },
    180_000,
  );
}
