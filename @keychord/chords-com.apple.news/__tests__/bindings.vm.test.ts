import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  runCommand,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type ChordApp,
  type MacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.news";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/news/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };

type Behavior = (app: ChordApp, probe: MacOSProbe, key: string) => Promise<void>;

const controls = async (probe: MacOSProbe, depth = 5) =>
  flattenAX([await probe.window(bundle, depth)]);

const menu = (probe: MacOSProbe, ...path: string[]) =>
  probe.menu(bundle, ...path).catch(() => undefined);
const startupButtons = [
  "Continue",
  "No Thanks",
  "Not Now",
  "Done",
  "close",
  "Turn Off Personalized Ads",
];

async function dismiss(probe: MacOSProbe, labels: string[], triedDisabled?: Set<string>) {
  const window = await probe.window(bundle, 10).catch((error: unknown) => {
    if (/com\.apple\.news is not running/.test(String(error))) return undefined;
    throw error;
  });
  if (!window) return false;
  const dialogs = flattenAX([window]).filter(
    (node) => node.role === "AXSheet" || node.subrole === "AXDialog",
  );
  const button = flattenAX(dialogs).find(
    (node) =>
      node.role === "AXButton" &&
      labels.some((label) => [node.title, node.description].includes(label)),
  );
  if (!button?.position || !button.size) return false;
  const label = button.title ?? button.description!;
  if (button.enabled === false) {
    if (!triedDisabled || triedDisabled.has(label)) return false;
    triedDisabled.add(label);
  }
  const [x, y] = button.position;
  const [width, height] = button.size!;
  await probe.clickPoint(x + width / 2, y + height / 2);
  return true;
}

async function closeDocument(probe: MacOSProbe, kind: "Window" | "Tab") {
  const close = await waitFor(async () => {
    if (await dismiss(probe, startupButtons)) return;
    for (const title of [`Close ${kind}`, "Close"]) {
      if ((await menu(probe, "File", title))?.enabled) return title;
    }
  });
  await probe.press(bundle, "File", close);
}

async function newWindow(app: ChordApp, probe: MacOSProbe, key: string) {
  const count = async () =>
    (await probe.windows(bundle)).filter((window) => window.id === "SceneWindow").length;
  const before = await waitFor(async () => (await count()) || undefined);
  try {
    await app.runChecked(key);
    await waitFor(async () => (await count()) === before + 1 || undefined, 12_000);
  } finally {
    if ((await count()) > before) {
      await closeDocument(probe, "Window");
      await waitFor(async () => ((await count()) === before ? true : undefined));
    }
  }
}

async function tabs(probe: MacOSProbe) {
  if (await dismiss(probe, startupButtons)) return [];
  return (await controls(probe, 6))
    .filter((node) => node.role === "AXTabGroup")
    .flatMap((group) => group.children ?? [])
    .filter((node) => node.role === "AXRadioButton" || node.subrole === "AXTabButton");
}

async function newTab(app: ChordApp, probe: MacOSProbe, key: string) {
  const triedDisabled = new Set<string>();
  const multiple = async () =>
    (await menu(probe, "Window", "Move Tab to New Window"))?.enabled === true;
  expect(await multiple()).toBe(false);
  try {
    await app.runChecked(key);
    await waitFor(async () => {
      if (await dismiss(probe, startupButtons, triedDisabled)) return;
      return (await multiple()) || undefined;
    }, 15_000).catch(async (cause) => {
      const dialog = await probe.window(bundle, 7);
      const buttons = flattenAX([dialog])
        .filter(({ role }) => role === "AXButton" || role === "AXHeading")
        .map(({ title, description, id, enabled }) => ({ title, description, id, enabled }));
      throw new Error("News did not create a tab: " + JSON.stringify(buttons.slice(0, 15)), {
        cause,
      });
    });
  } finally {
    if (await multiple()) {
      await closeDocument(probe, "Tab");
      await waitFor(async () => !(await multiple()) || undefined);
    }
  }
}

async function discoverChannels(app: ChordApp, probe: MacOSProbe, key: string) {
  const picker = async () =>
    (await controls(probe, 9)).find(
      (node) =>
        ["AXSheet", "AXWindow", "AXHeading", "AXPopover", "AXDialog"].includes(node.role ?? "") &&
        [node.title, node.description, node.value].some(
          (text) => typeof text === "string" && /Discover Channels|Channels & Topics/.test(text),
        ),
    );
  const controlsForPicker = async () =>
    (await controls(probe, 11)).filter(
      ({ role, title, description }) =>
        ["AXSheet", "AXPopover", "AXHeading", "AXDialog"].includes(role ?? "") ||
        /Discover|Channels|Topics/i.test([title, description].filter(Boolean).join(" ")),
    );
  expect(await picker()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(picker, 15_000).catch(async (cause) => {
      const controls = (await controlsForPicker()).map(({ role, title, description, id }) => ({
        role,
        title,
        description,
        id,
      }));
      throw new Error(
        "News did not open Discover Channels: " + JSON.stringify(controls.slice(0, 35)),
        { cause },
      );
    });
  } finally {
    if (await picker()) {
      if (!(await dismiss(probe, ["Done", "Close", "close", "Cancel"]))) await probe.key(53);
      await waitFor(async () => {
        const window = await probe.window(bundle);
        return !(await picker()) && window.role !== "AXSheet" ? true : undefined;
      }, 12_000);
    }
  }
}

async function tabOverview(app: ChordApp, probe: MacOSProbe, key: string) {
  const overview = async () => (await menu(probe, "View", "Exit Tab Overview"))?.enabled;
  const count = async () => (await tabs(probe)).length || 1;
  const before = await count();
  await waitFor(async () => (await menu(probe, "File", "New Tab"))?.enabled || undefined);
  await probe.press(bundle, "File", "New Tab");
  try {
    await waitFor(
      async () =>
        (await count()) === before + 1 ||
        (await menu(probe, "Window", "Move Tab to New Window"))?.enabled ||
        undefined,
      12_000,
    );
    expect(await overview()).toBeFalsy();
    await app.runChecked(key);
    await waitFor(async () => ((await overview()) ? true : undefined), 12_000);
  } finally {
    if (await overview()) {
      await probe.press(bundle, "View", "Exit Tab Overview");
      await waitFor(async () => ((await overview()) ? undefined : true));
    }
    if ((await count()) > before) {
      await closeDocument(probe, "Tab");
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
        await app.runChecked(key);
        await waitFor(async () => ((await menuTitle()) === before ? true : undefined));
      }
    }
  };
}

async function openSettings(app: ChordApp, probe: MacOSProbe, key: string) {
  const settings = async () =>
    (await probe.windows(bundle)).find((node) => node.title === "News Settings");
  expect(await settings()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(settings, 10_000);
  } finally {
    const opened = await settings();
    if (opened?.title) {
      await probe.closeWindow(bundle, opened.title);
      await waitFor(async () => !(await settings()) || undefined);
    }
  }
}

const tabKeys = ["t[", "t]"] as const;

async function switchTabs(app: ChordApp, probe: MacOSProbe) {
  const count = async () => (await tabs(probe)).length || 1;
  const selected = async () =>
    (await tabs(probe)).findIndex((tab) => tab.selected || tab.value === 1 || tab.value === true);
  const original = await count();
  expect(original).toBe(1);
  await probe.press(bundle, "File", "New Tab");
  await waitFor(async () => (await count()) === 2 || undefined, 12_000);
  const added = await waitFor(async () => {
    const index = await selected();
    if (index >= 0) return index;
  });
  const selectTab = async (index: number) => {
    if ((await selected()) === index) return;
    const tab = (await tabs(probe))[index];
    expect(tab?.position && tab.size).toBeDefined();
    const [x, y] = tab.position!;
    const [width, height] = tab.size!;
    await probe.clickPoint(x + width / 2, y + height / 2);
    await waitFor(async () => (await selected()) === index || undefined);
  };
  try {
    await selectTab(1);
    for (const [index, key] of tabKeys.entries()) {
      const title = index === 0 ? "Show Previous Tab" : "Show Next Tab";
      await waitFor(async () => (await menu(probe, "Window", title))?.enabled || undefined).catch(
        async (cause) => {
          throw new Error(
            "News did not enable " +
              title +
              ": " +
              JSON.stringify({ selected: await selected(), tabs: await tabs(probe) }),
            { cause },
          );
        },
      );
      await app.runChecked(key);
      await waitFor(async () => (await selected()) === index || undefined, 12_000).catch(
        async (cause) => {
          const states = (await tabs(probe)).map(({ title, value, selected }) => ({
            title,
            value,
            selected,
          }));
          throw new Error(
            "News did not select the tab after " + key + ": " + JSON.stringify(states),
            { cause },
          );
        },
      );
      console.log("News " + key + " passed");
    }
  } finally {
    await selectTab(added);
    await closeDocument(probe, "Tab");
    await waitFor(async () => (await count()) === original || undefined);
  }
}

const cases: Record<string, Behavior> = {
  vs: toggleView("Sidebar"),
  tn: newTab,
  ta: tabOverview,
  vt: toggleView("Tab Bar"),
  sa: openSettings,
  gd: discoverChannels,
  wn: newWindow,
};

test("every News binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...Object.keys(cases), ...tabKeys].sort());
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
        const triedDisabled = new Set<string>();
        const ready = () => {
          let requestedForeground = false;
          return waitFor(async () => {
            if (await dismiss(probe, startupButtons, triedDisabled)) return;
            if (!(await probe.running(bundle)) || (await probe.front()) !== bundle) {
              if (!requestedForeground) {
                await runCommand(["/usr/bin/open", "-b", bundle]);
                requestedForeground = true;
              }
              return;
            }
            const main = await probe.window(bundle).catch((error: unknown) => {
              if (/com\.apple\.news is not running/.test(String(error))) return undefined;
              throw error;
            });
            const ready = main?.role === "AXWindow" && main.subrole === "AXStandardWindow";
            if (ready && (await menu(probe, "File", "New Window"))?.enabled) return main;
          }, 30_000).catch(async (cause) => {
            const views = (await controls(probe, 9))
              .filter(({ role }) => ["AXButton", "AXHeading", "AXSheet"].includes(role ?? ""))
              .map(({ role, title, description, id, enabled }) => ({
                role,
                title,
                description,
                id,
                enabled,
              }));
            throw new Error(
              "News did not reach its browser window: " +
                JSON.stringify({
                  window: await probe.window(bundle),
                  views: views.slice(0, 30),
                }),
              { cause },
            );
          });
        };
        const failures: string[] = [];
        await ready();
        await switchTabs(app, probe).catch((error: unknown) => {
          failures.push("News tab switching: " + String(error));
        });
        for (const [key, behavior] of Object.entries(cases)) {
          await ready();
          try {
            await behavior(app, probe, key);
            console.log(`News ${key} passed`);
          } catch (error) {
            const failure = `News ${key}: ${error}`;
            const window = await probe.window(bundle).catch(() => undefined);
            console.error(failure, JSON.stringify({ window }));
            failures.push(failure);
          }
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  300_000,
);
