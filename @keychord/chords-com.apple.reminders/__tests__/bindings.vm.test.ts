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
  await until(async () => {
    const current = await nodes(probe);
    if (current.some((node) => node.value === "Enable iCloud Syncing?")) {
      await probe.pressControl(bundleId, "AXButton", "Not Now");
      return false;
    }
    const welcome = current.some((node) =>
      [node.title, node.description, node.value].some(
        (text) =>
          typeof text === "string" &&
          /Welcome to Reminders|What’s New in Reminders|Never Miss a Reminder/i.test(text),
      ),
    );
    if (welcome) {
      const button = current.find(
        (node) =>
          node.role === "AXButton" &&
          ["Continue", "Get Started", "Done"].includes(node.title ?? ""),
      );
      if (button?.position && button.size && button.enabled !== false) {
        const [x, y] = button.position;
        const [width, height] = button.size;
        await probe.clickPoint(x + width / 2, y + height / 2);
      }
      return false;
    }
    return (await menu(probe, "File", "New Reminder").catch(() => undefined))?.enabled === true;
  }, "a writable reminder list");
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
  const initial = await entries();
  const available = initial.filter((node) => options.includes(node.title ?? ""));
  if (available.length === options.length && available.every((node) => node.enabled === false)) {
    for (const key of Object.keys(choices))
      await app.expectFailure(key, /Menu item .* is disabled/);
    return;
  }
  const original = initial.find((node) => node.mark && node.title)?.title;
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
        if (await cancel()) await probe.pressControl(bundleId, "AXButton", "Cancel");
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
  "creates, schedules, completes and deletes a local reminder": {
    keys: ["nr", "ed", "ec", "ex"],
    async run(app, probe) {
      const reminder = async () =>
        (await nodes(probe)).find(
          (node) =>
            node.role === "AXRow" &&
            flattenAX(node.children ?? []).some((child) =>
              [child.title, child.value].includes(fixture),
            ),
        );
      const rowExists = async () => Boolean(await reminder());
      const selectReminder = async () => {
        const target = await waitFor(async () => {
          const row = await reminder();
          return row?.position && row.size ? row : undefined;
        });
        const [x, y] = target.position!;
        const [width, height] = target.size!;
        await probe.clickPoint(x + width / 2, y + height / 2);
        await until(async () => {
          const row = await reminder();
          return Boolean(
            row && (row.selected || flattenAX(row.children ?? []).some((node) => node.focused)),
          );
        }, "the fixture reminder to receive focus");
      };
      const cancelListRemoval = async () => {
        if (
          !(await nodes(probe)).some(
            ({ value }) => value === "This will delete all reminders in this list.",
          )
        )
          return false;
        await probe.clickControl(bundleId, "AXButton", "Cancel");
        return true;
      };
      const toggle = async () =>
        flattenAX([await menu(probe, "View")]).find((node) =>
          ["Show Completed", "Hide Completed"].includes(node.title ?? ""),
        )?.title;
      const original = await waitFor(toggle);
      if (original === "Hide Completed") await press(probe, "View", original);
      await until(
        async () => (await toggle()) === "Show Completed",
        "completed reminders to be hidden",
      );
      expect(await rowExists()).toBe(false);
      try {
        await app.runChecked("nr");
        await until(
          async () => (await probe.focus(bundleId)).role === "AXTextField",
          "the new reminder title editor",
        );
        await probe.typeText(fixture);
        const titleEntered = async () =>
          (await probe.focus(bundleId)).value === fixture || undefined;
        if (!(await waitFor(titleEntered, 1_500).catch(() => undefined))) {
          const copy = Bun.spawn(["/usr/bin/pbcopy"], { stdin: new Blob([fixture]) });
          expect(await copy.exited).toBe(0);
          if ((await probe.focus(bundleId)).value) await press(probe, "Edit", "Select All");
          await press(probe, "Edit", "Paste");
          await until(
            async () => (await titleEntered()) === true,
            "the fixture title in the editor",
          );
        }
        await probe.key(36);
        await until(rowExists, "the fixture reminder");
        await prepare(probe);
        await selectReminder();

        await app.runChecked("ed");
        await until(async () => {
          const row = await reminder();
          return flattenAX(row ? [row] : []).some((node) =>
            [node.title, node.description, node.value].some(
              (value) => typeof value === "string" && /\bToday\b/.test(value),
            ),
          );
        }, "the reminder to display a due date of Today");

        const dismissSchedulingPrompt = async () => {
          if ((await probe.front()) !== bundleId) return false;
          const focus = await probe.focus(bundleId);
          if (
            focus.role !== "AXButton" ||
            focus.title !== "Continue" ||
            !focus.enabled ||
            !focus.focused ||
            !focus.position ||
            !focus.size
          )
            return false;
          const [x, y] = focus.position;
          const [width, height] = focus.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
          await until(
            async () => (await probe.focus(bundleId)).title !== "Continue",
            "the scheduling prompt to close",
          );
          await selectReminder();
          await probe.selectRow(bundleId, fixture);
          return true;
        };
        if (!(await dismissSchedulingPrompt())) await selectReminder();
        const canComplete = async () =>
          (await menu(probe, "Edit", "Mark as Completed")).enabled === true;
        if (!(await canComplete()) && (await probe.focus(bundleId)).role === "AXTextField") {
          await probe.key(53);
        }
        let enabledSince = 0;
        const completionReady = async () => {
          if ((await dismissSchedulingPrompt()) || !(await canComplete())) {
            enabledSince = 0;
            return false;
          }
          if (!enabledSince) enabledSince = Date.now();
          return Date.now() - enabledSince >= 350;
        };
        if (!(await canComplete())) await probe.selectRow(bundleId, fixture);
        await until(completionReady, "Mark as Completed for the selected reminder").catch(
          async (cause) => {
            throw new Error(
              "The fixture reminder is not ready to complete: " +
                JSON.stringify({
                  focus: await probe.focus(bundleId),
                  row: await reminder(),
                }),
              { cause },
            );
          },
        );
        try {
          await app.runChecked("ec");
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !/Menu item "Mark as Completed".*is disabled/.test(error.message) ||
            !(await rowExists())
          )
            throw error;
          // Chord did not dispatch the disabled command. Re-select the same reminder.
          await selectReminder();
          await probe.selectRow(bundleId, fixture);
          enabledSince = 0;
          await until(completionReady, "Mark as Completed after reselecting the fixture");
          await app.runChecked("ec");
        }
        const completed = (row: AXNode) =>
          flattenAX([row]).some(({ description }) =>
            /^Completed(?:,|$)|^Mark as Incomplete$/.test(description ?? ""),
          );
        await until(async () => {
          const row = await reminder();
          return !row || completed(row);
        }, "the fixture reminder to become completed").catch(async (cause) => {
          throw new Error(
            "Reminders did not complete the fixture: " +
              JSON.stringify({ row: await reminder(), completedView: await toggle() }),
            { cause },
          );
        });
        if ((await toggle()) === "Show Completed") await press(probe, "View", "Show Completed");
        await until(async () => {
          const row = await reminder();
          return Boolean(row && completed(row));
        }, "the completed reminder to be visible");
        await selectReminder();
        await app.runChecked("ex");
        await until(async () => {
          if (await cancelListRemoval()) throw new Error("Delete targeted the reminder list");
          return !(await rowExists());
        }, "the deleted reminder to leave the completed list");
      } finally {
        await cancelListRemoval();
        if (await rowExists()) await prepare(probe);
        if ((await toggle()) === "Show Completed") await press(probe, "View", "Show Completed");
        if (await rowExists()) {
          await selectReminder();
          await press(probe, "Edit", "Delete");
          await until(async () => {
            if (await cancelListRemoval()) throw new Error("Cleanup targeted the reminder list");
            return !(await rowExists());
          }, "fixture reminder cleanup");
        }
        const current = await toggle();
        if (current && current !== original) await press(probe, "View", current);
      }
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
