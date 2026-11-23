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

const bundle = "com.apple.weather";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/weather/macos.toml", import.meta.url)).text(),
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

const units = ["Celsius", "Fahrenheit"];

function temperatureUnit(unit: string): Behavior {
  return async (app, probe, key) => {
    const selected = async (name: string) => (await menu(probe, "View", name))?.mark;
    const original = await waitFor(async () => {
      for (const candidate of units) {
        if (await selected(candidate)) return candidate;
      }
    });
    if (original === unit) {
      await probe.press(
        bundle,
        "View",
        units.find((candidate) => candidate !== unit)!,
      );
    }
    try {
      await waitFor(async () => ((await selected(unit)) ? undefined : true));
      await app.runChecked(key);
      await waitFor(() => selected(unit));
    } finally {
      await probe.press(bundle, "View", original);
      await waitFor(() => selected(original));
    }
  };
}

async function addLocation(app: ChordApp, probe: MacOSProbe, key: string) {
  // The initial fixture has no preview to add. Check the real disabled menu item.
  const item = await waitFor(() => menu(probe, "File", "Add Location to List"));
  expect(item.enabled).toBe(false);
  await app.expectFailure(key, /Add Location to List.*is disabled/);
}

async function openMap(app: ChordApp, probe: MacOSProbe, key: string) {
  const map = async () =>
    (await controls(probe, 10)).find(
      (node) => node.role === "AXButton" && [node.title, node.description].includes("Collapse Map"),
    );
  expect(await map()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(map, 15_000);
  } finally {
    if (await map()) {
      await probe.pressControl(bundle, "AXButton", "Collapse Map");
      await waitFor(async () => ((await map()) ? undefined : true));
    }
  }
}

const cases: Record<string, Behavior> = {
  js: focusSearch,
  vs: toggleView("Sidebar"),
  uc: temperatureUnit("Celsius"),
  uf: temperatureUnit("Fahrenheit"),
  la: addLocation,
  mo: openMap,
  sa: openSettings,
};

test("every Weather binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Weather chords change real application state",
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
          return (await menu(probe, "View", "Celsius"))?.enabled ? true : undefined;
        }, 30_000);
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
            await behavior(app, probe, key);
            console.log(`Weather ${key} passed`);
          } catch (error) {
            const failure = `Weather ${key}: ${error}`;
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
