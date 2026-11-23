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

const bundleId = "com.apple.reminders";

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

const fixture = "Pim";
const menu = (probe: MacOSProbe, ...path: string[]) => probe.menu(bundleId, ...path);
const press = (probe: MacOSProbe, ...path: string[]) => probe.press(bundleId, ...path);

async function prepare(probe: MacOSProbe) {
  const welcome = (await nodes(probe)).some((node) =>
    [node.title, node.value].some(
      (text) =>
        typeof text === "string" && /Welcome to Reminders|What’s New in Reminders/i.test(text),
    ),
  );
  if (welcome) {
    const button = (await nodes(probe)).find(
      (node) =>
        node.role === "AXButton" && ["Continue", "Get Started", "Done"].includes(node.title ?? ""),
    );
    expect(button?.title).toBeDefined();
    await probe.pressControl(bundleId, "AXButton", button!.title!);
  }
  await until(
    async () => (await menu(probe, "File", "New Reminder")).enabled === true,
    "a writable reminder list",
  );
}

const layouts = { vl: "as List", vb: "as Columns" };
const sorts = { sd: "Due Date", st: "Title" };

async function selectModes(
  app: ChordApp,
  probe: MacOSProbe,
  path: string[],
  choices: Record<string, string>,
) {
  const entries = async () => flattenAX([await menu(probe, ...path)]);
  const options = Object.values(choices);
  const original = (await entries()).find((node) => node.mark && node.title)?.title;
  expect(original).toBeDefined();
  const marked = async (title: string) => Boolean((await menu(probe, ...path, title)).mark);
  try {
    for (const [key, label] of Object.entries(choices)) {
      if (await marked(label)) {
        const other = options.find((candidate) => candidate !== label)!;
        await press(probe, ...path, other);
        await until(() => marked(other), other + " to be marked before running " + key);
      }
      await app.runChecked(key);
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
  "creates, schedules, completes and deletes a local reminder": {
    keys: ["nr", "ed", "ec", "ex"],
    async run(app, probe) {
      const rowExists = async () =>
        (await nodes(probe)).some(
          (node) =>
            node.role === "AXRow" &&
            flattenAX(node.children ?? []).some((child) =>
              [child.title, child.value].includes(fixture),
            ),
        );
      const selected = async () => probe.selectRow(bundleId, fixture);
      const toggle = async () =>
        flattenAX([await menu(probe, "View")]).find((node) =>
          ["Show Completed", "Hide Completed"].includes(node.title ?? ""),
        )?.title;
      const original = await waitFor(toggle);
      if (original === "Hide Completed") await press(probe, "View", original);
      expect(await rowExists()).toBe(false);
      try {
        await app.runChecked("nr");
        await until(
          async () => (await probe.focus(bundleId)).role === "AXTextField",
          "the new reminder title editor",
        );
        await probe.key(35, 1 << 17);
        await probe.key(34);
        await probe.key(46);
        await probe.key(36);
        await until(rowExists, "the fixture reminder");
        await selected();

        await app.runChecked("ed");
        await until(async () => {
          const row = (await nodes(probe)).find(
            (node) =>
              node.role === "AXRow" &&
              flattenAX(node.children ?? []).some((child) =>
                [child.title, child.value].includes(fixture),
              ),
          );
          return flattenAX(row ? [row] : []).some((node) =>
            [node.title, node.description, node.value].some(
              (value) => typeof value === "string" && /\bToday\b/.test(value),
            ),
          );
        }, "the reminder to display a due date of Today");

        await app.runChecked("ec");
        await until(
          async () => !(await rowExists()),
          "the completed reminder to leave the active list",
        );
        await press(probe, "View", "Show Completed");
        await until(rowExists, "the completed reminder to reappear");
        await selected();
        await app.runChecked("ex");
        await until(
          async () => !(await rowExists()),
          "the deleted reminder to leave the completed list",
        );
      } finally {
        if ((await toggle()) === "Show Completed") await press(probe, "View", "Show Completed");
        if (await rowExists()) {
          await selected();
          await press(probe, "Edit", "Delete");
          await until(async () => !(await rowExists()), "fixture reminder cleanup");
        }
        const current = await toggle();
        if (current && current !== original) await press(probe, "View", current);
      }
    },
  },
  "opens the list composer and focuses search": {
    keys: ["nl", "jr"],
    async run(app, probe) {
      const cancel = async () =>
        (await nodes(probe)).some((node) => node.role === "AXButton" && node.title === "Cancel");
      expect(await cancel()).toBe(false);
      await app.runChecked("nl");
      try {
        await until(cancel, "the new list dialog");
      } finally {
        await probe.key(53);
      }
      await until(async () => !(await cancel()), "the new list dialog to close");

      const focused = async () => (await probe.focus(bundleId)).subrole === "AXSearchField";
      expect(await focused()).toBe(false);
      await app.runChecked("jr");
      try {
        await until(focused, "the search field to receive focus");
      } finally {
        await probe.key(53);
      }
    },
  },
  "changes layout and sort order": {
    keys: [...Object.keys(layouts), ...Object.keys(sorts)],
    async run(app, probe) {
      await selectModes(app, probe, ["View"], layouts);
      await selectModes(app, probe, ["View", "Sort By"], sorts);
    },
  },
  "shows completed reminders and toggles the sidebar": {
    keys: ["vc", "vs"],
    async run(app, probe) {
      const title = async (label: string) =>
        flattenAX([await menu(probe, "View")]).find((node) =>
          ["Show " + label, "Hide " + label].includes(node.title ?? ""),
        )?.title;
      const original = await waitFor(() => title("Completed"));
      if (original === "Hide Completed") await press(probe, "View", original);
      await until(
        async () => (await title("Completed")) === "Show Completed",
        "completed items to be hidden",
      );
      try {
        await app.runChecked("vc");
        await until(
          async () => (await title("Completed")) === "Hide Completed",
          "completed items to be shown",
        );
      } finally {
        const current = await title("Completed");
        if (current && current !== original) await press(probe, "View", current);
      }
      const sidebar = await waitFor(() => title("Sidebar"));
      const changed = sidebar === "Show Sidebar" ? "Hide Sidebar" : "Show Sidebar";
      await app.runChecked("vs");
      try {
        await until(async () => (await title("Sidebar")) === changed, changed);
      } finally {
        if ((await title("Sidebar")) === changed) await app.runChecked("vs");
      }
      await until(
        async () => (await title("Sidebar")) === sidebar,
        "the original sidebar visibility",
      );
    },
  },
};

test("every Reminders binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/reminders/macos.toml", import.meta.url)).text(),
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
    "Reminders " + name,
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
              "Reminders windows",
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
