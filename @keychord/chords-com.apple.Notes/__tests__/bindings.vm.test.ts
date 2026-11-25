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

const bundleId = "com.apple.Notes";

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

const note = "Pim";
const menu = (probe: MacOSProbe, ...path: string[]) => probe.menu(bundleId, ...path);
const press = (probe: MacOSProbe, ...path: string[]) => probe.press(bundleId, ...path);

async function prepare(probe: MacOSProbe) {
  const dismissICloud = async () => {
    if (!(await nodes(probe)).some((node) => node.value === "Turn On iCloud")) return false;
    await probe.pressControl(bundleId, "AXButton", "Cancel");
    return true;
  };
  const dismissWelcome = async () => {
    const onboarding = await nodes(probe);
    const welcome = onboarding.some(({ title, value }) =>
      [title, value].some(
        (text) => typeof text === "string" && /Welcome to Notes|What’s New in Notes/i.test(text),
      ),
    );
    if (welcome) {
      const button = onboarding.find(
        ({ role, title, description, enabled, position, size }) =>
          role === "AXButton" &&
          [title, description].includes("Continue") &&
          enabled &&
          position &&
          size,
      );
      if (button?.position && button.size) {
        const [x, y] = button.position;
        const [width, height] = button.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
        return true;
      }
    }
    return false;
  };
  await until(async () => {
    if ((await dismissICloud()) || (await dismissWelcome())) return false;
    return (
      (await menu(probe, "File", "New Note")).enabled === true ||
      (await menu(probe, "Notes", "Settings…")).enabled === true
    );
  }, "Notes to finish onboarding");
  if ((await menu(probe, "File", "New Note")).enabled === false) {
    await press(probe, "Notes", "Settings…");
    try {
      const label = "Enable the On My Mac account";
      const checkbox = async () =>
        (await nodes(probe)).find(
          (node) => node.role === "AXCheckBox" && [node.title, node.description].includes(label),
        );
      const item = await waitFor(checkbox, 10_000);
      if (!item.value) await probe.pressControl(bundleId, "AXCheckBox", label);
      await until(async () => Boolean((await checkbox())?.value), "the local Notes account");
    } finally {
      const settings = await probe.windows(bundleId);
      if (settings.some((window) => window.title === "Notes Settings")) {
        await probe.closeWindow(bundleId, "Notes Settings");
      }
    }
  }
  await until(
    async () =>
      !(await dismissICloud()) &&
      !(await dismissWelcome()) &&
      (await menu(probe, "File", "New Note")).enabled === true,
    "a writable Notes folder",
  );
}

const views = { vl: "as List", vg: "as Gallery" };
const sorts = { sd: "Date Edited", sc: "Date Created", st: "Title" };
const toggles = { vs: "Sidebar", va: "Attachments Browser" };

async function setMarked(
  app: ChordApp,
  probe: MacOSProbe,
  choices: Record<string, string>,
  path: string[],
) {
  const labels = Object.values(choices);
  const marked = async (label: string) => Boolean((await menu(probe, ...path, label)).mark);
  const original = flattenAX([await menu(probe, ...path)]).find(
    (node) =>
      node.role === "AXMenuItem" &&
      node.mark &&
      (labels.includes(node.title ?? "") || /^Default(?: \(.+\))?$/.test(node.title ?? "")),
  )?.title;
  expect(original).toBeDefined();
  try {
    for (const [sequence, label] of Object.entries(choices)) {
      if (await marked(label)) {
        const other = labels.find((candidate) => candidate !== label)!;
        await press(probe, ...path, other);
        await until(async () => !(await marked(label)), other + " to be selected");
      }
      await app.runChecked(sequence);
      await until(() => marked(label), label + " to be marked");
    }
  } finally {
    if (original) {
      await press(probe, ...path, original);
      await until(() => marked(original), original + " to be restored");
    }
  }
}

const scenarios: Record<string, Scenario> = {
  "opens the new-folder dialog and focuses note search": {
    keys: ["nf", "jn"],
    async run(app, probe) {
      const sheet = async () =>
        (await nodes(probe)).some((node) => node.role === "AXButton" && node.title === "Cancel");
      expect(await sheet()).toBe(false);
      await app.runChecked("nf");
      try {
        await until(sheet, "the new-folder dialog");
      } finally {
        if (await sheet()) await probe.pressControl(bundleId, "AXButton", "Cancel");
      }
      await until(async () => !(await sheet()), "the folder dialog to close");

      const focused = async () => (await probe.focus(bundleId)).subrole === "AXSearchField";
      expect(await focused()).toBe(false);
      await app.runChecked("jn");
      try {
        await until(focused, "the note list search field");
      } finally {
        await probe.key(53);
      }
    },
  },
  "switches gallery, list and sort order": {
    keys: [...Object.keys(views), ...Object.keys(sorts)],
    async run(app, probe) {
      await setMarked(app, probe, views, ["View"]);
      await setMarked(app, probe, sorts, ["View", "Sort By"]);
    },
  },
  "toggles sidebar and attachments browser": {
    keys: Object.keys(toggles),
    async run(app, probe) {
      for (const [sequence, label] of Object.entries(toggles)) {
        const title = async () =>
          flattenAX([await menu(probe, "View")]).find((node) =>
            ["Show " + label, "Hide " + label].includes(node.title ?? ""),
          )?.title;
        const before = await waitFor(title, 10_000);
        const after = before.startsWith("Show ") ? "Hide " + label : "Show " + label;
        await app.runChecked(sequence);
        try {
          await until(async () => (await title()) === after, after);
        } finally {
          if ((await title()) === after) await app.runChecked(sequence);
        }
        await until(async () => (await title()) === before, before);
      }
    },
  },
  "creates, duplicates, exports and deletes a local note": {
    keys: ["nn", "ed", "xp", "ex"],
    async run(app, probe) {
      await press(probe, "View", "as List");
      expect((await nodes(probe)).some((node) => node.value === note)).toBe(false);
      const rows = async () =>
        (await nodes(probe)).filter((node) => {
          if (node.role !== "AXRow") return false;
          const children = flattenAX(node.children ?? []);
          if (children.some(({ role }) => role === "AXRow")) return false;
          return [node, ...children].some((child) =>
            [child.title, child.value, child.description].some(
              (value) =>
                typeof value === "string" && (value === note || value.startsWith(note + ",")),
            ),
          );
        });
      const save = async () =>
        (await nodes(probe)).some((node) => node.role === "AXButton" && node.title === "Save");
      const afterDelete = (removed: () => Promise<boolean>, expected: string) =>
        until(async () => {
          if (
            (await nodes(probe)).some(
              ({ value }) => value === "Deleted notes are moved to the Recently Deleted folder.",
            )
          ) {
            await probe.clickControl(bundleId, "AXButton", "action-button-1");
            return false;
          }
          return removed();
        }, expected);
      const selectNote = async () => {
        const showsFixture = async () =>
          (await nodes(probe)).some(
            ({ role, id, value }) =>
              role === "AXTextArea" &&
              id?.startsWith("Note[id=") &&
              typeof value === "string" &&
              value.trim() === note,
          );
        if (!(await showsFixture())) await probe.selectRow(bundleId, note);
        await until(showsFixture, "the fixture note to open");
      };
      const selectNoteForDeletion = async () => {
        await selectNote();
        const deleteEnabled = async () =>
          (await menu(probe, "Edit", "Delete Note").catch(() => undefined))?.enabled === true;
        if (await deleteEnabled()) return;
        const row = await waitFor(async () =>
          (await rows()).find(({ position, size }) => position && size && size[0] > 0),
        );
        await probe.clickPoint(
          row.position![0] + row.size![0] / 2,
          row.position![1] + row.size![1] / 2,
        );
        await until(deleteEnabled, "Delete Note for the selected fixture");
      };
      const initialBody = (await nodes(probe)).find(
        (node) => node.role === "AXTextArea" && node.id?.startsWith("Note[id="),
      )?.id;
      let draftId: string | undefined;
      try {
        await app.runChecked("nn");
        const editor = await waitFor(async () =>
          (await nodes(probe)).find(
            (node) =>
              node.role === "AXTextArea" &&
              node.id?.startsWith("Note[id=") &&
              node.id !== initialBody,
          ),
        );
        draftId = editor.id;
        await probe.clickControl(bundleId, "AXTextArea", draftId!);
        await until(
          async () => (await probe.focus(bundleId)).id === draftId,
          "the new note editor",
        );
        const draftBody = async () => (await nodes(probe)).find(({ id }) => id === draftId)?.value;
        const hasFixtureText = async () => {
          const value = await draftBody();
          return typeof value === "string" && value.trim() === note;
        };
        await probe.typeText(note);
        const typed = await waitFor(async () => (await hasFixtureText()) || undefined, 2_000).catch(
          () => false,
        );
        if (!typed && !(await draftBody())) {
          const copy = Bun.spawn(["/usr/bin/pbcopy"], { stdin: new Blob([note]) });
          expect(await copy.exited).toBe(0);
          if ((await probe.focus(bundleId)).id !== draftId) {
            throw new Error("The new note editor lost focus before Paste");
          }
          await press(probe, "Edit", "Paste");
        }
        await until(hasFixtureText, "the fixture text in the new note editor");
        await until(async () => (await rows()).length === 1, "one local note titled " + note).catch(
          async (cause) => {
            const labels = (await nodes(probe))
              .filter(({ role }) => role === "AXRow")
              .map((row) =>
                flattenAX([row]).map(({ title, value, description }) => ({
                  title,
                  value,
                  description,
                })),
              );
            throw new Error(
              `The new note did not appear in the note list: ${JSON.stringify(labels).slice(0, 1600)}`,
              { cause },
            );
          },
        );
        await selectNote();
        await app.runChecked("ed");
        await until(async () => (await rows()).length === 2, "the duplicate note in the list");

        await app.runChecked("xp");
        await until(save, "the PDF save panel");
        await probe.pressControl(bundleId, "AXButton", "Cancel");
        await until(async () => !(await save()), "the PDF save panel to close");

        await selectNoteForDeletion();
        await app.runChecked("ex");
        await afterDelete(
          async () => (await rows()).length === 1,
          "the selected note to leave the folder",
        );
      } catch (cause) {
        console.error("Notes fixture behavior", cause);
        throw cause;
      } finally {
        if (await save()) await probe.pressControl(bundleId, "AXButton", "Cancel");
        if (draftId && !(await rows()).length) {
          const current = await nodes(probe);
          if (current.some((node) => node.id === draftId)) {
            const draft = current.find(
              (node) =>
                node.subrole === "AXTableRow" && node.selected && node.position && node.size,
            );
            if (draft) {
              await press(probe, "Edit", "Delete Note");
              await afterDelete(
                async () => !(await nodes(probe)).some((node) => node.id === draftId),
                "the unfinished fixture draft to close",
              );
            }
          }
        }
        while ((await rows()).length > 0) {
          const before = (await rows()).length;
          await selectNoteForDeletion();
          await press(probe, "Edit", "Delete Note");
          await afterDelete(async () => (await rows()).length < before, "fixture note cleanup");
        }
      }
    },
  },
};

test("every Notes binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/Notes/macos.toml", import.meta.url)).text(),
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
    "Notes " + name,
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
              "Notes windows",
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
