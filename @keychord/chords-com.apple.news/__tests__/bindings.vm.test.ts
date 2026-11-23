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

const bundle = "com.apple.news";
const command = 1 << 20;
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/news/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };

type Behavior = (app: ChordApp, probe: MacOSProbe, key: string) => Promise<void>;

const controls = async (probe: MacOSProbe, depth = 5) =>
  flattenAX([await probe.window(bundle, depth)]);

const menu = (probe: MacOSProbe, ...path: string[]) =>
  probe.menu(bundle, ...path).catch(() => undefined);

async function dismiss(probe: MacOSProbe, labels: string[]) {
  const button = (await controls(probe, 8)).find(
    (node) =>
      node.role === "AXButton" &&
      labels.some((label) => [node.title, node.description].includes(label)),
  );
  if (!button) return false;
  await probe.pressControl(bundle, "AXButton", button.title || button.description!);
  return true;
}

async function newWindow(app: ChordApp, probe: MacOSProbe, key: string) {
  const count = async () =>
    (await probe.windows(bundle)).filter((window) => window.subrole === "AXStandardWindow").length;
  const before = await count();
  expect(before).toBeGreaterThan(0);
  try {
    await app.runChecked(key);
    await waitFor(async () => ((await count()) === before + 1 ? true : undefined));
  } finally {
    if ((await count()) > before) {
      await probe.key(13, command);
      await waitFor(async () => ((await count()) === before ? true : undefined));
    }
  }
}

async function tabs(probe: MacOSProbe) {
  return (await controls(probe, 6))
    .filter((node) => node.role === "AXTabGroup")
    .flatMap((group) => group.children ?? [])
    .filter((node) => node.role === "AXRadioButton" || node.subrole === "AXTabButton");
}

async function newTab(app: ChordApp, probe: MacOSProbe, key: string) {
  const count = async () => (await tabs(probe)).length || 1;
  const before = await count();
  try {
    await app.runChecked(key);
    await waitFor(async () => ((await count()) === before + 1 ? true : undefined));
  } finally {
    if ((await count()) > before) {
      await probe.key(13, command);
      await waitFor(async () => ((await count()) === before ? true : undefined));
    }
  }
}

async function discoverChannels(app: ChordApp, probe: MacOSProbe, key: string) {
  const picker = async () =>
    (await controls(probe, 9)).find(
      (node) =>
        (node.role === "AXSheet" || node.role === "AXWindow" || node.role === "AXHeading") &&
        [node.title, node.description, node.value].some(
          (text) => typeof text === "string" && /Discover Channels|Channels & Topics/.test(text),
        ),
    );
  expect(await picker()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(picker, 15_000);
  } finally {
    if (await picker()) {
      await probe.key(53);
      await waitFor(async () => ((await picker()) ? undefined : true));
    }
  }
}

async function tabOverview(app: ChordApp, probe: MacOSProbe, key: string) {
  const overview = async () => (await menu(probe, "View", "Exit Tab Overview"))?.enabled;
  const count = async () => (await tabs(probe)).length || 1;
  const before = await count();
  await probe.press(bundle, "File", "New Tab");
  try {
    await waitFor(async () => ((await count()) === before + 1 ? true : undefined));
    expect(await overview()).toBeFalsy();
    await app.runChecked(key);
    await waitFor(async () => ((await overview()) ? true : undefined));
  } finally {
    if (await overview()) {
      await probe.press(bundle, "View", "Exit Tab Overview");
      await waitFor(async () => ((await overview()) ? undefined : true));
    }
    if ((await count()) > before) {
      await probe.key(13, command);
      await waitFor(async () => ((await count()) === before ? true : undefined));
    }
  }
}

function toggleView(label: string): Behavior {
  return async (app, probe, key) => {
    const menuTitle = async () => {
      const view = await menu(probe, "View");
      return (
        view &&
        flattenAX([view]).find(
          (node) =>
            node.enabled && (node.title === `Show ${label}` || node.title === `Hide ${label}`),
        )?.title
      );
    };
    const before = await waitFor(menuTitle);
    const after = before === `Show ${label}` ? `Hide ${label}` : `Show ${label}`;
    try {
      await app.runChecked(key);
      await waitFor(async () => ((await menuTitle()) === after ? true : undefined));
    } finally {
      if ((await menuTitle()) === after) {
        await probe.press(bundle, "View", after);
        await waitFor(async () => ((await menuTitle()) === before ? true : undefined));
      }
    }
  };
}

async function openSettings(app: ChordApp, probe: MacOSProbe, key: string) {
  const before = (await probe.windows(bundle)).length;
  const settings = async () => {
    const windows = await probe.windows(bundle, 3);
    return (
      windows.length > before &&
      windows.some((node) => /Settings|Preferences|General|Sources/.test(node.title ?? ""))
    );
  };
  expect(await settings()).toBe(false);
  try {
    await app.runChecked(key);
    await waitFor(async () => ((await settings()) ? true : undefined), 10_000);
  } finally {
    if (await settings()) {
      await probe.key(13, 1 << 20);
      await waitFor(async () => ((await settings()) ? undefined : true));
    }
  }
}

function switchTab(direction: "Previous" | "Next"): Behavior {
  return async (app, probe, key) => {
    const initial = (await tabs(probe)).length || 1;
    const selectedIndex = async () =>
      (await tabs(probe)).findIndex((tab) => tab.selected || tab.value === 1 || tab.value === true);
    let createdTab: number | undefined;
    await probe.press(bundle, "File", "New Tab");
    try {
      await waitFor(async () => ((await tabs(probe)).length === initial + 1 ? true : undefined));
      createdTab = await waitFor(async () => {
        const index = await selectedIndex();
        return index < 0 ? undefined : index;
      });
      const newTab = createdTab;
      const previous = (newTab + initial) % (initial + 1);
      if (direction === "Next") {
        await probe.press(bundle, "Window", "Show Previous Tab");
        await waitFor(async () => ((await selectedIndex()) === previous ? true : undefined));
      }
      await app.runChecked(key);
      const expected = direction === "Next" ? newTab : previous;
      await waitFor(async () => ((await selectedIndex()) === expected ? true : undefined));
    } finally {
      if (createdTab !== undefined) {
        if ((await selectedIndex()) !== createdTab) {
          await probe.press(bundle, "Window", "Show Next Tab");
          await waitFor(async () => ((await selectedIndex()) === createdTab ? true : undefined));
        }
        await probe.key(13, command);
        await waitFor(async () =>
          ((await tabs(probe)).length || 1) === initial ? true : undefined,
        );
      }
    }
  };
}

const cases: Record<string, Behavior> = {
  wn: newWindow,
  tn: newTab,
  "t[": switchTab("Previous"),
  "t]": switchTab("Next"),
  ta: tabOverview,
  gd: discoverChannels,
  vs: toggleView("Sidebar"),
  vt: toggleView("Tab Bar"),
  sa: openSettings,
};

test("every News binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "News chords change real application state",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(async () => {
          if (await dismiss(probe, ["Continue", "No Thanks", "Not Now", "Done"])) return;
          return (await menu(probe, "File", "New Window"))?.enabled ? true : undefined;
        }, 45_000);
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
            await behavior(app, probe, key);
            console.log(`News ${key} passed`);
          } catch (error) {
            const failure = `News ${key}: ${error}`;
            console.error(failure);
            failures.push(failure);
          }
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  300_000,
);
