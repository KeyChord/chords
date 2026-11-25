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
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/stocks/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };

type Behavior = (app: ChordApp, probe: MacOSProbe, key: string) => Promise<void>;

const controls = async (probe: MacOSProbe, depth = 5) =>
  flattenAX([await probe.window(bundle, depth)]);

const menu = (probe: MacOSProbe, ...path: string[]) =>
  probe.menu(bundle, ...path).catch(() => undefined);

async function dismiss(probe: MacOSProbe, labels: string[], triedDisabled: Set<string>) {
  const window = await probe.window(bundle, 10);
  const dialogs = flattenAX([window]).filter(
    (node) => node.role === "AXSheet" || node.subrole === "AXDialog",
  );
  const button = flattenAX(dialogs).find(
    (node) =>
      node.role === "AXButton" &&
      (labels.some((label) => [node.title, node.description].includes(label)) ||
        (node.description === "close" && node.id?.startsWith("modal-host-vc-close-"))),
  );
  if (!button?.position || !button.size) return false;
  const label = button.title ?? button.description!;
  if (button.enabled === false) {
    if (triedDisabled.has(label)) return false;
    triedDisabled.add(label);
  }
  const [x, y] = button.position;
  const [width, height] = button.size;
  await probe.clickPoint(x + width / 2, y + height / 2);
  return true;
}

async function newWindow(app: ChordApp, probe: MacOSProbe, key: string) {
  const windows = async () =>
    (await probe.windows(bundle)).filter((window) => window.subrole === "AXStandardWindow");
  const before = await windows();
  expect(before.length).toBeGreaterThan(0);
  await app.runChecked(key);
  await waitFor(
    async () => (await windows()).length === before.length + 1 || undefined,
    12_000,
  ).catch(async (cause) => {
    throw new Error(
      "Stocks did not open another window: " + JSON.stringify({ before, after: await windows() }),
      { cause },
    );
  });
}

async function newTab(app: ChordApp, probe: MacOSProbe, key: string) {
  const windows = () => probe.windows(bundle);
  const before = await windows();
  const focused = await probe.window(bundle);
  const original =
    focused.subrole === "AXStandardWindow" && focused.position && focused.size
      ? focused
      : before.find(
          (window) => window.subrole === "AXStandardWindow" && window.position && window.size,
        );
  expect(original).toBeDefined();
  expect((await menu(probe, "File", "New Tab"))?.enabled).toBe(true);
  const tabGroup = async () => {
    if ((await menu(probe, "Window", "Move Tab to New Window"))?.enabled === true) return true;
    return (await controls(probe, 9)).some(
      (node) =>
        node.role === "AXTabGroup" &&
        (node.children ?? []).filter(
          ({ role, subrole }) =>
            role === "AXTab" || role === "AXRadioButton" || subrole === "AXTabButton",
        ).length > 1,
    );
  };
  expect(await tabGroup()).toBe(false);
  await app.runChecked(key);
  await waitFor(async () => {
    if (await tabGroup()) return true;
    const current = await windows();
    return (
      (current.length === before.length + 1 &&
        current.some(({ title }) => title === original?.title) &&
        current.some(
          (view) =>
            view.title &&
            !before.some(({ title }) => title === view.title) &&
            view.position?.join(",") === original?.position?.join(",") &&
            view.size?.join(",") === original?.size?.join(","),
        )) ||
      undefined
    );
  }, 12_000).catch(async (cause) => {
    throw new Error(
      "Stocks did not open a tab: " + JSON.stringify({ original, windows: await windows() }),
      { cause },
    );
  });
}

async function focusSearch(app: ChordApp, probe: MacOSProbe, key: string) {
  const focused = async () => {
    const focus = await probe.focus(bundle);
    return (
      focus.subrole === "AXSearchField" ||
      (focus.role === "AXTextField" && [focus.title, focus.description].includes("Search"))
    );
  };
  if (await focused()) await probe.key(53);
  if (await focused()) await probe.key(48);
  await waitFor(async () => !(await focused()) || undefined).catch(async (cause) => {
    throw new Error(
      "Stocks Search already had focus before the chord: " +
        JSON.stringify(await probe.focus(bundle)),
      { cause },
    );
  });
  await app.runChecked(key);
  await waitFor(async () => (await focused()) || undefined).catch(async (cause) => {
    const dialogs = (await controls(probe, 9)).filter(
      (node) => node.role === "AXSheet" || node.subrole === "AXDialog",
    );
    throw new Error(
      "Stocks did not focus Search: " +
        JSON.stringify({ focus: await probe.focus(bundle), dialogs }),
      { cause },
    );
  });
}

async function toggleSidebar(app: ChordApp, probe: MacOSProbe, key: string) {
  const commands = async () => {
    const view = await menu(probe, "View");
    return view
      ? flattenAX([view]).filter(
          ({ title }) => title === "Show Sidebar" || title === "Hide Sidebar",
        )
      : [];
  };
  const sidebarCommand = async () => (await commands()).find((item) => item.enabled)?.title;
  const waitForSidebarCommand = (expected?: string) =>
    waitFor(async () => {
      const command = await sidebarCommand();
      return command && (!expected || command === expected) ? command : undefined;
    }, 10_000).catch(async (cause) => {
      throw new Error(
        "Stocks sidebar did not reach " +
          (expected ?? "an enabled command") +
          ": " +
          JSON.stringify({
            window: await probe.window(bundle),
            focus: await probe.focus(bundle),
            commands: await commands(),
          }),
        { cause },
      );
    });
  const before = await waitForSidebarCommand();
  const after = before === "Show Sidebar" ? "Hide Sidebar" : "Show Sidebar";
  try {
    await app.runChecked(key);
    await waitForSidebarCommand(after);
  } finally {
    if ((await sidebarCommand()) === after) await app.runChecked(key);
    await waitForSidebarCommand(before);
  }
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
    if (group === sortOrders && original === "Manual") {
      await chooseSort(probe, "Symbol");
      await waitFor(async () => (await selectedSort(probe, sortFields)) === "Symbol" || undefined);
    }
    if ((await selectedSort(probe, group)) === title) {
      await chooseSort(
        probe,
        group.find((candidate) => candidate !== title)!,
      );
    }
    try {
      await waitFor(async () => {
        const selected = await selectedSort(probe, group);
        return selected &&
          selected !== title &&
          (await menu(probe, "View", "Sort Watchlist By", title))?.enabled
          ? true
          : undefined;
      });
      await app.runChecked(key);
      await waitFor(async () => ((await selectedSort(probe, group)) === title ? true : undefined));
    } finally {
      await chooseSort(probe, original);
      await waitFor(async () =>
        (await selectedSort(probe, sortFields)) === original ? true : undefined,
      );
      if (order && original !== "Manual") {
        await chooseSort(probe, order);
        await waitFor(async () => (await selectedSort(probe, sortOrders)) === order || undefined);
      }
    }
  };
}

function watchlistDialog(label: string): Behavior {
  return async (app, probe, key) => {
    const dialog = async () =>
      (await controls(probe, 8)).find((node) =>
        [node.title, node.description, node.value].includes(label),
      );
    expect(await dialog()).toBeUndefined();
    try {
      await app.runChecked(key);
      await waitFor(dialog, 12_000).catch(async (cause) => {
        const controls = flattenAX(await probe.windows(bundle, 8))
          .filter(({ role }) =>
            ["AXSheet", "AXTextField", "AXButton", "AXHeading"].includes(role ?? ""),
          )
          .map(({ role, title, description, id }) => ({ role, title, description, id }));
        throw new Error(
          "Stocks did not open " + label + ": " + JSON.stringify(controls.slice(0, 30)),
          { cause },
        );
      });
    } finally {
      if (await dialog()) {
        const dismiss = (await controls(probe, 8)).find(
          (node) =>
            node.role === "AXButton" &&
            node.enabled &&
            [node.title, node.description].some((text) => text === "Done" || text === "Cancel"),
        );
        if (dismiss?.position && dismiss.size?.every((dimension) => dimension > 0)) {
          const [x, y] = dismiss.position;
          const [width, height] = dismiss.size;
          await probe.clickPoint(x + width / 2, y + height / 2);
        }
        if (await dialog()) await probe.key(53);
        await waitFor(async () => ((await dialog()) ? undefined : true), 12_000).catch((cause) => {
          throw new Error(`Stocks did not dismiss ${label}`, { cause });
        });
      }
    }
  };
}

const cases: Record<string, Behavior> = {
  vs: toggleSidebar,
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
  // The disposable guest keeps the new windows and the final Search focus.
  wn: newWindow,
  tn: newTab,
  js: focusSearch,
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
        const triedDisabled = new Set<string>();
        const dismissIntro = () =>
          dismiss(
            probe,
            ["Continue", "Turn Off Personalized Ads", "Not Now", "Done"],
            triedDisabled,
          );
        const ready = () =>
          waitFor(async () => {
            if (await dismissIntro()) return;
            const main = await probe.window(bundle);
            return (
              (main.role === "AXWindow" &&
                main.subrole === "AXStandardWindow" &&
                (await menu(probe, "View", "Sort Watchlist By"))?.enabled) ||
              undefined
            );
          }, 20_000).catch(async (cause) => {
            const firstRun = (await controls(probe, 8))
              .filter(({ role }) => role === "AXSheet" || role === "AXButton")
              .map(({ role, title, description, id, enabled }) => ({
                role,
                title,
                description,
                id,
                enabled,
              }));
            throw new Error(
              "Stocks did not open its watchlist: " +
                JSON.stringify({
                  window: await probe.window(bundle),
                  focus: await probe.focus(bundle),
                  firstRun: firstRun.slice(0, 30),
                }),
              { cause },
            );
          });
        await ready();
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
            const watchlistControl = key === "js" || key === "vs";
            for (let prompts = 0; ; prompts++) {
              if (watchlistControl) await ready();
              try {
                await behavior(app, probe, key);
                break;
              } catch (cause) {
                // The ads prompt and the News offer can both appear during the first action.
                if (!watchlistControl || prompts >= 2 || !(await dismissIntro())) throw cause;
                console.log("Stocks dismissed a late native prompt before retesting " + key);
              }
            }
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
