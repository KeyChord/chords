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

const bundle = "com.apple.helpviewer";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/helpviewer/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };

type Behavior = (app: ChordApp, probe: MacOSProbe, key: string) => Promise<void>;

const controls = async (probe: MacOSProbe, depth = 5) =>
  flattenAX([await probe.window(bundle, depth)]);

const menu = (probe: MacOSProbe, ...path: string[]) =>
  probe.menu(bundle, ...path).catch(() => undefined);

async function focusGuideContent(probe: MacOSProbe) {
  const heading = (await controls(probe, 13)).find(
    (node) =>
      node.role === "AXHeading" &&
      [node.title, node.description].some((title) => /^Mac User Guide(?: |$)/.test(title ?? "")) &&
      node.position &&
      node.size,
  );
  if (heading) {
    const [x, y] = heading.position!;
    const [width, height] = heading.size!;
    await probe.clickPoint(x + width / 2, y + height / 2);
  }
}

async function focusSearch(app: ChordApp, probe: MacOSProbe, key: string) {
  const focused = async () => {
    const field = await probe.focus(bundle);
    return (
      field.subrole === "AXSearchField" ||
      field.role === "AXSearchField" ||
      (field.role === "AXTextField" &&
        [field.title, field.description, field.id].some((label) => /search/i.test(label ?? "")))
    );
  };
  const searchField = () =>
    probe.windowElement(bundle, "AXSearchField", "AXTextField", "AXSearchField");
  if (await focused()) await probe.key(53);
  if (await focused()) await focusGuideContent(probe);
  if (await focused()) await probe.key(48);
  await waitFor(async () => ((await focused()) ? undefined : true)).catch(async (cause) => {
    throw new Error("Tips search already had focus: " + JSON.stringify(await probe.focus(bundle)), {
      cause,
    });
  });
  const before = await searchField();
  try {
    await app.runChecked(key);
    await waitFor(async () => {
      if (await focused()) return true;
      return !before && (await searchField()) ? true : undefined;
    }, 10_000).catch(async (cause) => {
      throw new Error(
        "Tips did not open its Guide search: " +
          JSON.stringify({ window: await probe.window(bundle), focus: await probe.focus(bundle) }),
        { cause },
      );
    });
  } finally {
    if ((await focused()) || (!before && (await searchField()))) await probe.key(53);
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

async function pageMatches(probe: MacOSProbe, title: string) {
  const nodes = await controls(probe, 13);
  if (title === "What’s New in macOS") {
    return ["What’s New", "See what’s new in macOS."].every((label) =>
      nodes.some(
        (node) =>
          node.role === "AXStaticText" &&
          [node.title, node.description, node.value].includes(label),
      ),
    );
  }
  const expected = title.toLowerCase();
  return nodes.some(
    (node) =>
      node.role === "AXHeading" &&
      node.value === 1 &&
      [node.title, node.description].some((text) => {
        const heading = text?.toLowerCase().replace(/['’]/g, "’");
        return heading === expected || heading?.startsWith(expected + " ");
      }),
  );
}

async function waitForPage(probe: MacOSProbe, title: string) {
  await waitFor(async () => (await pageMatches(probe, title)) || undefined, 25_000).catch(
    async (cause) => {
      const visible = (await controls(probe, 13))
        .filter(({ role }) => ["AXHeading", "AXStaticText", "AXWebArea"].includes(role ?? ""))
        .map(({ role, title, description, value, url }) => ({
          role,
          title,
          description,
          value,
          url,
        }));
      throw new Error(
        "Tips did not open " +
          title +
          ": " +
          JSON.stringify({ window: await probe.window(bundle), visible: visible.slice(0, 35) }),
        { cause },
      );
    },
  );
}

async function leavePage(probe: MacOSProbe, title: string) {
  const home = (await controls(probe, 6)).find(
    (node) => node.role === "AXButton" && node.id === "house" && node.enabled,
  );
  if (home) await probe.clickControl(bundle, "AXButton", "house");
  else await probe.key(33, 1 << 20);
  const left = async () => !(await pageMatches(probe, title)) || undefined;
  if (!(await waitFor(left, 2_000).catch(() => undefined))) {
    await probe.key(53);
    if (await pageMatches(probe, title)) await probe.key(33, 1 << 20);
  }
  await waitFor(left, 12_000).catch((cause) => {
    throw new Error("Tips did not leave " + title, { cause });
  });
}

function inGuide(behavior: Behavior, leave = true): Behavior {
  return async (app, probe, key) => {
    const guide = "Mac User Guide";
    if (!(await pageMatches(probe, guide))) {
      await probe.press(bundle, "Help", guide);
      await waitForPage(probe, guide);
    }
    try {
      await behavior(app, probe, key);
    } finally {
      if (leave) await leavePage(probe, guide);
    }
  };
}

function openGuide(title: string): Behavior {
  return async (app, probe, key) => {
    expect(await pageMatches(probe, title)).toBe(false);
    try {
      await app.runChecked(key);
      await waitForPage(probe, title);
    } finally {
      if (await pageMatches(probe, title)) await leavePage(probe, title);
    }
  };
}

async function findOnPage(app: ChordApp, probe: MacOSProbe, key: string) {
  await focusGuideContent(probe);
  const find = await waitFor(() => menu(probe, "Edit", "Search", "Find…"), 12_000);
  if (find.enabled === false) {
    await app.expectFailure(key, /Menu item "Find…".*is disabled/);
    return;
  }
  const findBar = async () =>
    (await controls(probe, 9)).find(
      (node) =>
        (node.role === "AXButton" && [node.title, node.description].includes("Done")) ||
        (node.role === "AXTextField" &&
          [node.title, node.description, node.id].some(
            (label) => typeof label === "string" && /^Find(?:\b|InPage)/i.test(label),
          )),
    );
  expect(await findBar()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(findBar, 12_000).catch(async (cause) => {
      throw new Error(
        "Tips did not show Find on Page: " + JSON.stringify(await probe.focus(bundle)),
        { cause },
      );
    });
  } finally {
    const bar = await findBar();
    if (bar) {
      if (bar.role === "AXButton") await probe.clickControl(bundle, "AXButton", "Done");
      else await probe.key(53);
      if (!(await waitFor(async () => !(await findBar()) || undefined, 2_000).catch(() => false))) {
        await probe.key(53);
      }
    }
  }
}

const cases: Record<string, Behavior> = {
  js: inGuide(focusSearch),
  vs: inGuide(toggleView("Sidebar")),
  gg: openGuide("Mac User Guide"),
  gn: openGuide("What’s New in macOS"),
  ff: inGuide(findOnPage, false),
};

test("every Tips binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Tips chords change real application state",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(async () => {
          const window = await probe.window(bundle);
          return window.role === "AXWindow" ? true : undefined;
        }, 20_000);
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
            await behavior(app, probe, key);
            console.log(`Tips ${key} passed`);
          } catch (error) {
            const failure = `Tips ${key}: ${error}`;
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
