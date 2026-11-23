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

const bundle = "com.apple.stocks";
const command = 1 << 20;
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/stocks/macos.toml", import.meta.url)).text(),
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

const sortFields = ["Manual", "Symbol", "Name", "Price Change", "Percentage Change", "Market Cap"];
const sortOrders = ["Ascending", "Descending"];

async function selectedSort(probe: MacOSProbe, options: string[]) {
  for (const option of options) {
    if ((await menu(probe, "View", "Sort Watchlist By", option))?.mark) return option;
  }
}

async function chooseSort(probe: MacOSProbe, title: string) {
  await probe.press(bundle, "View", "Sort Watchlist By", title);
}

function sortWatchlist(title: string): Behavior {
  return async (app, probe, key) => {
    const original = await waitFor(() => selectedSort(probe, sortFields));
    const order = await selectedSort(probe, sortOrders);
    const group = sortOrders.includes(title) ? sortOrders : sortFields;
    if (group === sortOrders && original === "Manual") await chooseSort(probe, "Symbol");
    if ((await selectedSort(probe, group)) === title) {
      await chooseSort(
        probe,
        group.find((candidate) => candidate !== title)!,
      );
    }
    try {
      await waitFor(async () => ((await selectedSort(probe, group)) !== title ? true : undefined));
      await app.runChecked(key);
      await waitFor(async () => ((await selectedSort(probe, group)) === title ? true : undefined));
    } finally {
      if (order && original !== "Manual") await chooseSort(probe, order);
      await chooseSort(probe, original);
      await waitFor(async () =>
        (await selectedSort(probe, sortFields)) === original ? true : undefined,
      );
    }
  };
}

function watchlistDialog(label: string): Behavior {
  return async (app, probe, key) => {
    const dialog = async () =>
      (await controls(probe, 8)).find(
        (node) =>
          node.role === "AXSheet" ||
          node.role === "AXPopover" ||
          [node.title, node.description, node.value].includes(label),
      );
    expect(await dialog()).toBeUndefined();
    try {
      await app.runChecked(key);
      await waitFor(dialog, 12_000);
    } finally {
      if (await dialog()) {
        await probe.key(53);
        await waitFor(async () => ((await dialog()) ? undefined : true));
      }
    }
  };
}

const cases: Record<string, Behavior> = {
  wn: newWindow,
  tn: newTab,
  js: focusSearch,
  vs: toggleView("Sidebar"),
  ln: watchlistDialog("Enter a name for this watchlist."),
  lm: watchlistDialog("Manage Watchlists"),
  sm: sortWatchlist("Manual"),
  ss: sortWatchlist("Symbol"),
  sn: sortWatchlist("Name"),
  sc: sortWatchlist("Price Change"),
  sp: sortWatchlist("Percentage Change"),
  sk: sortWatchlist("Market Cap"),
  sa: sortWatchlist("Ascending"),
  sd: sortWatchlist("Descending"),
};

test("every Stocks binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Stocks chords change real application state",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(async () => {
          if (await dismiss(probe, ["Continue", "Not Now"])) return;
          return (await menu(probe, "View", "Sort Watchlist By"))?.enabled ? true : undefined;
        }, 30_000);
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
            await behavior(app, probe, key);
            console.log(`Stocks ${key} passed`);
          } catch (error) {
            const failure = `Stocks ${key}: ${error}`;
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
