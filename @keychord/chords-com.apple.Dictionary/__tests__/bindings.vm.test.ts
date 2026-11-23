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
      await probe.key(13, 1 << 20);
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
  const count = async () => (await tabs(probe)).length || 1;
  const before = await count();
  await probe.press(bundle, "File", "New Tab");
  try {
    await waitFor(async () => ((await count()) === before + 1 ? true : undefined));
    await lookup(probe, "apple");
    await lookup(probe, "orange");
    await probe.press(bundle, "Go", "Back");
    await waitFor(async () => ((await query(probe)) === "apple" ? true : undefined));
    await app.runChecked(key);
    await waitFor(async () => ((await query(probe)) === "orange" ? true : undefined));
  } finally {
    if ((await count()) > before) {
      await probe.key(13, command);
      await waitFor(async () => ((await count()) === before ? true : undefined));
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
    const all = "All Dictionaries";
    await probe.press(bundle, "Search", all);
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
      await probe.press(bundle, "Search", all);
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
        await probe.activate(bundle);
        await waitFor(
          async () =>
            (await menu(probe, "Edit", "Find", "Search For a New Word…"))?.enabled
              ? true
              : undefined,
          20_000,
        );
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
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
