import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
  type ChordApp,
  type MacOSProbe,
  type AXNode,
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

async function pageMatches(probe: MacOSProbe, title: string) {
  const window = await probe.window(bundle, 9);
  const match = (label: AXNode) =>
    [label.title, label.description].some((text) => text?.includes(title));
  return (
    match(window) || flattenAX([window]).some((node) => node.role === "AXWebArea" && match(node))
  );
}

function openGuide(title: string): Behavior {
  return async (app, probe, key) => {
    expect(await pageMatches(probe, title)).toBe(false);
    try {
      await app.runChecked(key);
      await waitFor(async () => ((await pageMatches(probe, title)) ? true : undefined), 20_000);
    } finally {
      if (await pageMatches(probe, title)) {
        // Command-[ returns to the help landing page.
        await probe.key(33, 1 << 20);
        await waitFor(async () => ((await pageMatches(probe, title)) ? undefined : true));
      }
    }
  };
}

async function findOnPage(app: ChordApp, probe: MacOSProbe, key: string) {
  await probe.press(bundle, "Help", "Mac User Guide");
  try {
    await waitFor(
      async () => ((await pageMatches(probe, "Mac User Guide")) ? true : undefined),
      20_000,
    );
    const findBar = async () =>
      (await controls(probe, 9)).find(
        (node) => node.role === "AXButton" && [node.title, node.description].includes("Done"),
      );
    expect(await findBar()).toBeUndefined();
    try {
      await app.runChecked(key);
      await waitFor(findBar);
    } finally {
      if (await findBar()) {
        await probe.key(53);
        await waitFor(async () => ((await findBar()) ? undefined : true));
      }
    }
  } finally {
    await probe.key(33, 1 << 20);
    await waitFor(async () => ((await pageMatches(probe, "Mac User Guide")) ? undefined : true));
  }
}

const cases: Record<string, Behavior> = {
  js: focusSearch,
  vs: toggleView("Sidebar"),
  gg: openGuide("Mac User Guide"),
  gn: openGuide("What’s New in macOS"),
  ff: findOnPage,
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
