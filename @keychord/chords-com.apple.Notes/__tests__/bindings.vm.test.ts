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
const cmd = 1 << 20;
const shift = 1 << 17;
const menu = (probe: MacOSProbe, ...path: string[]) => probe.menu(bundleId, ...path);
const press = (probe: MacOSProbe, ...path: string[]) => probe.press(bundleId, ...path);

async function prepare(probe: MacOSProbe) {
  const onboarding = await nodes(probe);
  if (
    onboarding.some(({ title, value }) =>
      [title, value].some(
        (text) => typeof text === "string" && /Welcome to Notes|What’s New in Notes/i.test(text),
      ),
    )
  ) {
    await probe.pressControl(bundleId, "AXButton", "Continue");
  }
  await until(
    async () =>
      (await menu(probe, "File", "New Note")).enabled === true ||
      (await menu(probe, "Notes", "Settings…")).enabled === true,
    "Notes to finish onboarding",
  );
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
      await probe.key(13, cmd);
    }
  }
  await until(
    async () => (await menu(probe, "File", "New Note")).enabled === true,
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
  initialChoices: string[],
) {
  const marked = async (label: string) => Boolean((await menu(probe, ...path, label)).mark);
  let original: string | undefined;
  for (const label of initialChoices) {
    if (await marked(label)) {
      original = label;
      break;
    }
  }
  expect(original).toBeDefined();
  try {
    for (const [sequence, label] of Object.entries(choices)) {
      if (await marked(label)) {
        const other = initialChoices.find((candidate) => candidate !== label)!;
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
  "creates, duplicates, exports and deletes a local note": {
    keys: ["nn", "ed", "xp", "ex"],
    async run(app, probe) {
      await press(probe, "View", "as List");
      expect((await nodes(probe)).some((node) => node.value === note)).toBe(false);
      const rows = async () =>
        (await nodes(probe)).filter(
          (node) =>
            node.role === "AXRow" &&
            flattenAX(node.children ?? []).some((child) =>
              [child.title, child.value].includes(note),
            ),
        );
      try {
        await app.runChecked("nn");
        await until(
          async () => (await probe.focus(bundleId)).role === "AXTextArea",
          "the new note editor",
        );
        await probe.key(35, shift);
        await probe.key(34);
        await probe.key(46);
        await until(async () => (await rows()).length === 1, "one local note titled " + note);
        await app.runChecked("ed");
        await until(async () => (await rows()).length === 2, "the duplicate note in the list");

        await app.runChecked("xp");
        const save = async () =>
          (await nodes(probe)).some((node) => node.role === "AXButton" && node.title === "Save");
        await until(save, "the PDF save panel");
        await probe.key(53);
        await until(async () => !(await save()), "the PDF save panel to close");

        await probe.selectRow(bundleId, note);
        await app.runChecked("ex");
        await until(
          async () => (await rows()).length === 1,
          "the selected note to leave the folder",
        );
      } finally {
        await probe.key(53);
        while ((await rows()).length > 0) {
          const before = (await rows()).length;
          await probe.selectRow(bundleId, note);
          await press(probe, "Edit", "Delete");
          await until(async () => (await rows()).length < before, "fixture note cleanup");
        }
      }
    },
  },
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
        await probe.key(53);
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
      await setMarked(app, probe, views, ["View"], Object.values(views));
      await setMarked(app, probe, sorts, ["View", "Sort By"], ["Default", ...Object.values(sorts)]);
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
