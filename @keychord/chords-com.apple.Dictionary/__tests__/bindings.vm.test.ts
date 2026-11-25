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

const bundle = "com.apple.Dictionary";
const command = 1 << 20;
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/Dictionary/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };

type Behavior = (app: ChordApp, probe: MacOSProbe, key: string) => Promise<void>;

const controls = async (probe: MacOSProbe, depth = 5) =>
  flattenAX([await probe.window(bundle, depth)]);

const menu = (probe: MacOSProbe, ...path: string[]) =>
  probe.menu(bundle, ...path).catch(() => undefined);

async function closeDocument(probe: MacOSProbe, tab = false) {
  const close = await waitFor(async () => {
    for (const label of [tab ? "Close Tab" : "Close Window", "Close"]) {
      if ((await menu(probe, "File", label))?.enabled) return label;
    }
  });
  await probe.press(bundle, "File", close);
}

async function newWindow(app: ChordApp, probe: MacOSProbe, key: string) {
  const windows = async () =>
    (await probe.windows(bundle)).filter((window) => window.subrole === "AXStandardWindow");
  const before = (await windows()).length;
  expect(before).toBeGreaterThan(0);
  await waitFor(async () => (await menu(probe, "File", "New Window"))?.enabled || undefined);
  try {
    await app.runChecked(key);
    await waitFor(async () => (await windows()).length === before + 1 || undefined, 12_000).catch(
      async (cause) => {
        const current = await windows();
        const tab = await menu(probe, "Window", "Show Next Tab");
        throw new Error(
          "Dictionary did not open a separate window: " +
            JSON.stringify({
              before,
              current,
              tab,
            }),
          { cause },
        );
      },
    );
  } finally {
    if ((await windows()).length > before) {
      await closeDocument(probe);
      await waitFor(async () => (await windows()).length === before || undefined, 12_000);
    }
  }
}

const multipleTabs = async (probe: MacOSProbe) => {
  const next = await menu(probe, "Window", "Show Next Tab");
  if (next?.enabled) return true;
  const detach = await menu(probe, "Window", "Move Tab to New Window");
  if (detach?.enabled) return true;
  return (await controls(probe, 7)).some(
    (node) =>
      node.role === "AXTabGroup" &&
      (node.children ?? []).filter(
        (child) => child.role === "AXRadioButton" || child.subrole === "AXTabButton",
      ).length > 1,
  );
};

async function newTab(app: ChordApp, probe: MacOSProbe, key: string) {
  expect(await multipleTabs(probe)).toBe(false);
  try {
    await app.runChecked(key);
    await waitFor(async () => (await multipleTabs(probe)) || undefined, 15_000).catch(
      async (cause) => {
        const file = await menu(probe, "File", "New Tab");
        const tabs = await menu(probe, "Window", "Show Next Tab");
        throw new Error(
          "Dictionary did not expose a second tab: " +
            JSON.stringify({ file, tabs, window: await probe.window(bundle) }),
          { cause },
        );
      },
    );
  } finally {
    if (await multipleTabs(probe)) {
      await closeDocument(probe, true);
      await waitFor(async () => !(await multipleTabs(probe)) || undefined, 12_000);
    }
  }
}

async function focusSearch(app: ChordApp, probe: MacOSProbe, key: string) {
  const focused = async () => (await probe.focus(bundle)).subrole === "AXSearchField";
  if (await focused()) await probe.key(48);
  await waitFor(async () => ((await focused()) ? undefined : true));
  try {
    await app.runChecked(key);
    await waitFor(async () => ((await focused()) ? true : undefined));
  } finally {
    if (await focused()) await probe.key(53);
  }
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
      await probe.key(13, command);
      await waitFor(async () => ((await settings()) ? undefined : true));
    }
  }
}

const search = (probe: MacOSProbe) => probe.focus(bundle);
const query = async (probe: MacOSProbe) =>
  (await controls(probe, 6)).find((node) => node.subrole === "AXSearchField")?.value;

async function lookup(probe: MacOSProbe, word: string) {
  await probe.activate(bundle, `x-dictionary:d:${word}`);
  await waitFor(async () => ((await query(probe)) === word ? true : undefined), 15_000);
}

async function historyForward(app: ChordApp, probe: MacOSProbe, key: string) {
  const hadTabs = await multipleTabs(probe);
  if (!hadTabs) await probe.press(bundle, "File", "New Tab");
  try {
    await waitFor(async () => (await multipleTabs(probe)) || undefined);
    await lookup(probe, "apple");
    await lookup(probe, "orange");
    await waitFor(async () => (await menu(probe, "Go", "Back"))?.enabled || undefined);
    await probe.press(bundle, "Go", "Back");
    await waitFor(async () =>
      (await query(probe)) === "apple" && (await menu(probe, "Go", "Forward"))?.enabled
        ? true
        : undefined,
    );
    await app.runChecked(key);
    await waitFor(async () => ((await query(probe)) === "orange" ? true : undefined));
  } finally {
    if (!hadTabs && (await multipleTabs(probe))) {
      await closeDocument(probe, true);
      await waitFor(async () => !(await multipleTabs(probe)) || undefined);
    }
  }
}

const source = async (probe: MacOSProbe) =>
  (await controls(probe, 7)).find(
    (node) =>
      (node.role === "AXRadioButton" || node.role === "AXButton") &&
      (node.selected || node.value === 1 || node.value === true),
  )?.title;

function switchSource(direction: "all" | "next" | "previous"): Behavior {
  return async (app, probe, key) => {
    const all = "All";
    await probe.press(bundle, "Search", "All Dictionaries");
    await waitFor(async () => ((await source(probe)) === all ? true : undefined));
    if (direction !== "next") await probe.press(bundle, "Search", "Select Next Dictionary");
    const before = await waitFor(async () => {
      const selected = await source(probe);
      return selected && (direction === "next") === (selected === all) ? selected : undefined;
    });
    try {
      await app.runChecked(key);
      await waitFor(async () => {
        const after = await source(probe);
        return after && after !== before && (direction === "next") === (after !== all)
          ? true
          : undefined;
      });
    } finally {
      await probe.press(bundle, "Search", "All Dictionaries");
      await waitFor(async () => ((await source(probe)) === all ? true : undefined));
    }
  };
}

async function findInDefinition(app: ChordApp, probe: MacOSProbe, key: string) {
  await lookup(probe, "apple");
  const findBar = async () =>
    (await controls(probe, 9)).find(
      (node) => node.role === "AXButton" && [node.title, node.description].includes("Done"),
    );
  expect(await findBar()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(findBar, 12_000);
    const focused = await search(probe);
    expect(focused.role).toBe("AXTextField");
  } finally {
    if (await findBar()) {
      await probe.key(53);
      await waitFor(async () => ((await findBar()) ? undefined : true));
    }
  }
}

const cases: Record<string, Behavior> = {
  wn: newWindow,
  tn: newTab,
  js: focusSearch,
  ga: switchSource("all"),
  "g[": switchSource("previous"),
  "g]": switchSource("next"),
  gf: historyForward,
  ff: findInDefinition,
  sa: openSettings,
};

test("every Dictionary binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Dictionary chords change real application state",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        const window = async () =>
          (await probe.windows(bundle)).find(
            ({ role, subrole }) => role === "AXWindow" && subrole === "AXStandardWindow",
          );
        await lookup(probe, "apple");
        const main = await waitFor(window, 12_000);
        const identifier = main.title ?? main.id;
        if (identifier) await probe.raiseWindow(bundle, identifier);
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
            if (!(await probe.running(bundle)) || !(await window())) await lookup(probe, "apple");
            await waitFor(window, 12_000);
            await behavior(app, probe, key);
            console.log(`Dictionary ${key} passed`);
          } catch (error) {
            const failure = `Dictionary ${key}: ${error}`;
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
