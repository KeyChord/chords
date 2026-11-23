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

const bundle = "com.apple.Maps";
const command = 1 << 20;
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/Maps/macos.toml", import.meta.url)).text(),
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

const mapModes = ["Explore", "Driving", "Transit", "Satellite"];

function viewMode(title: string): Behavior {
  return async (app, probe, key) => {
    const path = ["View", title];
    const original = await waitFor(async () => {
      for (const candidate of mapModes) {
        if ((await menu(probe, "View", candidate))?.mark) return candidate;
      }
    });
    const alternate = title === "Explore" ? "Driving" : "Explore";
    if (original === title) await probe.press(bundle, "View", alternate);
    try {
      await waitFor(async () => ((await menu(probe, ...path))?.mark ? undefined : true));
      await app.runChecked(key);
      await waitFor(async () => (await menu(probe, ...path))?.mark || undefined);
    } finally {
      await probe.press(bundle, "View", original);
    }
  };
}

function zoomMap(direction: "In" | "Out"): Behavior {
  return async (app, probe, key) => {
    const scale = async () =>
      (await controls(probe, 9))
        .flatMap((node) => [node.value, node.title, node.description])
        .find(
          (label) =>
            typeof label === "string" && /^(?:Scale:? )?[\d,.]+\s*(?:km|m|mi|ft)$/.test(label),
        );
    const showScale = (await menu(probe, "View", "Show Scale"))?.enabled;
    if (showScale) await probe.press(bundle, "View", "Show Scale");
    try {
      const before = await waitFor(scale, 10_000);
      await app.runChecked(key);
      await waitFor(async () => {
        const after = await scale();
        return after !== before ? after : undefined;
      }, 10_000);
      await probe.press(bundle, "View", direction === "In" ? "Zoom Out" : "Zoom In");
      await waitFor(async () => ((await scale()) === before ? true : undefined), 10_000);
    } finally {
      if (showScale) await probe.press(bundle, "View", "Hide Scale");
    }
  };
}

async function printMap(app: ChordApp, probe: MacOSProbe, key: string) {
  const sheet = async () => (await controls(probe)).find((node) => node.role === "AXSheet");
  expect(await sheet()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(sheet, 15_000);
  } finally {
    if (await sheet()) {
      await probe.key(53);
      await waitFor(async () => ((await sheet()) ? undefined : true));
    }
  }
}

const cases: Record<string, Behavior> = {
  wn: newWindow,
  tn: newTab,
  js: focusSearch,
  me: viewMode("Explore"),
  md: viewMode("Driving"),
  mt: viewMode("Transit"),
  ms: viewMode("Satellite"),
  vs: toggleView("Sidebar"),
  vd: toggleView("Directions"),
  vm: toggleView("3D Map"),
  vc: toggleView("Scale"),
  zi: zoomMap("In"),
  zo: zoomMap("Out"),
  fp: printMap,
  sa: openSettings,
};

test("every Maps binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Maps chords change real application state",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(async () => {
          if (await dismiss(probe, ["Continue", "Not Now", "Don’t Allow"])) return;
          return (await menu(probe, "File", "New Window"))?.enabled ? true : undefined;
        }, 30_000);
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
            await behavior(app, probe, key);
            console.log(`Maps ${key} passed`);
          } catch (error) {
            const failure = `Maps ${key}: ${error}`;
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
