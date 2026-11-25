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

const bundleId = "com.apple.iCal";

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
  if (
    (await nodes(probe)).some(({ title, value }) =>
      [title, value].some(
        (text) =>
          typeof text === "string" && /Welcome to Calendar|What’s New in Calendar/i.test(text),
      ),
    )
  ) {
    await probe.pressControl(bundleId, "AXButton", "Continue");
  }
  await until(
    async () => (await menu(probe, "View", "By Month")).enabled === true,
    "the calendar views",
  );
}

const views = { vd: "By Day", vw: "By Week", vm: "By Month", vy: "By Year" };
const panels = { vs: "Calendar List", vn: "Notifications" };
const files = {
  fi: /^(Import|Open)$/,
  xa: /^(Save|Export)$/,
};

const scenarios: Record<string, Scenario> = {
  "selects day, week, month and year views": {
    keys: Object.keys(views),
    async run(app, probe) {
      const choices = Object.values(views);
      const current = async () => {
        const view = await menu(probe, "View").catch((error: unknown) => {
          if (error instanceof Error && error.message.includes("The app has no menu bar")) return;
          throw error;
        });
        if (view) {
          return flattenAX([view]).find((node) => node.mark && choices.includes(node.title ?? ""))
            ?.title;
        }
      };
      const original = await waitFor(current);
      try {
        for (const [key, label] of Object.entries(views)) {
          if ((await current()) === label) {
            const other = choices.find((choice) => choice !== label)!;
            await press(probe, "View", other);
            await until(async () => (await current()) === other, other);
          }
          await app.runChecked(key);
          await until(async () => (await current()) === label, label);
        }
      } finally {
        await press(probe, "View", original);
      }
    },
  },
  "navigates to the previous and next months, today and the date picker": {
    keys: ["g[", "g]", "gt", "gd"],
    async run(app, probe) {
      const original = await waitFor(
        async () =>
          flattenAX([await menu(probe, "View")]).find(
            (node) => node.mark && Object.values(views).includes(node.title ?? ""),
          )?.title,
      );
      const today = new Date();
      const showsMonth = async (offset: number) => {
        const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
        const month = date.toLocaleString("en-US", { month: "long" });
        const year = String(date.getFullYear());
        return (await nodes(probe)).some(
          (node) =>
            ["AXStaticText", "AXHeading", "AXWindow"].includes(node.role ?? "") &&
            [node.title, node.value, node.description].some(
              (text) => text === month || text === month + " " + year,
            ),
        );
      };
      await press(probe, "View", "By Month");
      await press(probe, "View", "Go to Today");
      await until(() => showsMonth(0), "the current month in the month view");
      const datePicker = async () =>
        (await probe.focus(bundleId)).role === "AXDateTimeArea" ||
        (await nodes(probe)).some((node) => node.role === "AXDateField");
      const closeDatePicker = async () => {
        if (await datePicker()) await probe.pressControl(bundleId, "AXButton", "Cancel");
      };
      try {
        for (const [key, offset] of [
          ["g[", -1],
          ["g]", 0],
          ["g]", 1],
          ["gt", 0],
        ] as const) {
          await app.runChecked(key);
          await until(() => showsMonth(offset), "month offset " + offset + " after " + key);
        }
        await app.runChecked("gd");
        await until(datePicker, "the Go to Date picker");
        await closeDatePicker();
        await until(async () => !(await datePicker()), "the date picker to close");
      } finally {
        await closeDatePicker();
        await press(probe, "View", "Go to Today");
        await press(probe, "View", original);
      }
    },
  },
  "creates, inspects and deletes a local event": {
    keys: ["ne", "ei", "ex"],
    async run(app, probe) {
      const event = async () =>
        (await nodes(probe)).find(
          (node) => node.role === "AXStaticText" && node.description?.startsWith(fixture + ". "),
        );
      const floatingInfo = async () =>
        (await probe.windows(bundleId, 8)).find(
          (window) =>
            window.subrole === "AXUnknown" &&
            flattenAX([window]).some(({ id, value }) => id === "title-field" && value === fixture),
        );
      const closeEventInfo = async () => {
        const window = await floatingInfo();
        if (window) {
          const close = window.children?.find(
            ({ role, description }) => role === "AXButton" && description === "Close Window",
          );
          if (!close?.position || !close.size)
            throw new Error("The event info window has no close button");
          await probe.clickPoint(
            close.position[0] + close.size[0] / 2,
            close.position[1] + close.size[1] / 2,
          );
          await until(
            async () => !(await floatingInfo()),
            "the floating event info window to close",
          );
        }
        if ((await probe.focus(bundleId)).id === "title-field") await probe.key(53);
      };
      const selectEvent = async (action: string) => {
        const frame = await waitFor(async () => {
          const item = await event();
          if (item?.position && item.size) return { position: item.position, size: item.size };
        });
        await probe.clickPoint(
          frame.position[0] + frame.size[0] / 2,
          frame.position[1] + frame.size[1] / 2,
        );
        await until(async () => Boolean((await menu(probe, "Edit", action)).enabled), action);
      };
      const original = await waitFor(
        async () =>
          flattenAX([await menu(probe, "View")]).find(
            (node) => node.mark && Object.values(views).includes(node.title ?? ""),
          )?.title,
      );
      await press(probe, "View", "By Day");
      await press(probe, "View", "Go to Today");
      expect(await event()).toBeUndefined();
      try {
        await app.runChecked("ne");
        await until(
          async () => (await probe.focus(bundleId)).id === "QuickEventCell",
          "the quick event entry",
        );
        const quickEntry = fixture + " today at 3pm";
        const entered = async () => (await probe.focus(bundleId)).value === quickEntry || undefined;
        await probe.typeText(quickEntry);
        if (!(await waitFor(entered, 1_500).catch(() => undefined))) {
          expect((await probe.focus(bundleId)).id).toBe("QuickEventCell");
          await probe.setFocusedText(bundleId, quickEntry);
        }
        await until(async () => Boolean(await entered()), "the entered event description");
        await probe.key(36);
        await until(async () => Boolean(await event()), "the event titled " + fixture);
        await closeEventInfo();

        await selectEvent("Get Info");
        await app.runChecked("ei");
        await until(async () => Boolean(await floatingInfo()), "the selected event's info window");
        await closeEventInfo();

        await selectEvent("Delete");
        await app.runChecked("ex");
        await until(async () => !(await event()), "the selected event to be deleted");
      } finally {
        if (await event()) {
          await closeEventInfo();
          await selectEvent("Delete");
          await press(probe, "Edit", "Delete");
          await until(async () => !(await event()), "fixture event cleanup");
        }
        await press(probe, "View", original);
      }
    },
  },
  "toggles the calendar list and notifications and focuses search": {
    keys: [...Object.keys(panels), "je"],
    async run(app, probe) {
      for (const [key, label] of Object.entries(panels)) {
        const state = async () =>
          flattenAX([await menu(probe, "View")]).find((node) =>
            ["Show " + label, "Hide " + label].includes(node.title ?? ""),
          )?.title;
        const original = await waitFor(state);
        const changed = (original.startsWith("Show ") ? "Hide " : "Show ") + label;
        await app.runChecked(key);
        try {
          await until(async () => (await state()) === changed, changed);
        } finally {
          if ((await state()) === changed) await app.runChecked(key);
        }
        await until(async () => (await state()) === original, original);
      }

      const focused = async () => (await probe.focus(bundleId)).subrole === "AXSearchField";
      expect(await focused()).toBe(false);
      await app.runChecked("je");
      try {
        await until(focused, "the event search field");
      } finally {
        await probe.key(53);
      }
    },
  },
  "opens the import and calendar archive panels": {
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
          if (await panel()) await probe.pressControl(bundleId, "AXButton", "Cancel");
        }
        await until(async () => !(await panel()), "the file panel to close");
      }
    },
  },
};

test("every Calendar binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/iCal/macos.toml", import.meta.url)).text(),
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
    "Calendar " + name,
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
              "Calendar windows",
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
