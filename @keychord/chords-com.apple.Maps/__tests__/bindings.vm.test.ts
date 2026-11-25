import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const bundle = "com.apple.Maps";
const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/Maps/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };

type Behavior = (app: ChordApp, probe: MacOSProbe, key: string) => Promise<void>;

const menu = (probe: MacOSProbe, ...path: string[]) =>
  probe.menu(bundle, ...path).catch(() => undefined);

async function dismiss(probe: MacOSProbe, labels: string[]) {
  const window = await probe.window(bundle, 10);
  if (window.role !== "AXSheet" && window.subrole !== "AXDialog") return false;
  const button = flattenAX([window]).find(
    (node) =>
      node.role === "AXButton" &&
      node.enabled &&
      labels.some((label) => [node.title, node.description].includes(label)),
  );
  if (!button?.position || !button.size) return false;
  const [x, y] = button.position;
  const [width, height] = button.size;
  await probe.clickPoint(x + width / 2, y + height / 2);
  return true;
}

async function newWindow(app: ChordApp, probe: MacOSProbe, key: string) {
  const windows = async () =>
    (await probe.windows(bundle)).filter((window) => window.subrole === "AXStandardWindow");
  const count = async () => (await windows()).length;
  const before = await waitFor(async () => (await count()) || undefined);
  try {
    await app.runChecked(key);
    await waitFor(async () => (await count()) === before + 1 || undefined, 12_000).catch(
      async (cause) => {
        throw new Error(
          "Maps did not open an additional window: " + JSON.stringify(await windows()),
          { cause },
        );
      },
    );
  } finally {
    if ((await count()) > before) {
      const close = await waitFor(async () => {
        const file = await probe.menu(bundle, "File");
        return flattenAX([file]).find(
          ({ title, enabled }) => enabled && /^(Close|Close Window)$/.test(title ?? ""),
        );
      });
      await probe.press(bundle, "File", close.title!);
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
    if (label === "3D Map") {
      const show = await menu(probe, "View", "Show 3D Map");
      if (show?.enabled === false) {
        await app.expectFailure(key, /Menu item "Show 3D Map".*is disabled/);
        return;
      }
    }
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
  const settings = async () =>
    (await probe.windows(bundle)).find((node) =>
      /Settings|Preferences|^General$/.test(node.title ?? ""),
    );
  expect(await settings()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(settings, 10_000);
  } finally {
    const open = await settings();
    if (open?.title) {
      await probe.closeWindow(bundle, open.title);
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
    const directory = await mkdtemp(join(tmpdir(), "chordtest-maps-zoom-"));
    const bitmap = join(directory, "map.bmp");
    const window = await waitFor(async () => {
      const current = await probe.window(bundle);
      return current.position && current.size ? current : undefined;
    });
    const [x, y] = window.position!;
    const [width, height] = window.size!;
    // Sample the map itself, away from the toolbar, sidebar, and window edge.
    const region = [x + 0.4 * width, y + 0.2 * height, 0.5 * width, 0.7 * height]
      .map(Math.floor)
      .join(",");
    const capture = async () => {
      expect(await probe.front()).toBe(bundle);
      await runCommand(["/usr/sbin/screencapture", "-x", "-t", "bmp", "-R" + region, bitmap]);
      if ((await probe.front()) !== bundle) await probe.activate(bundle);
      expect(await probe.front()).toBe(bundle);
      const image = await Bun.file(bitmap).arrayBuffer();
      const header = new DataView(image);
      expect(header.getUint16(0, false)).toBe(0x424d);
      return new Uint8Array(image, header.getUint32(10, true));
    };
    const difference = (before: Uint8Array, after: Uint8Array) => {
      expect(after.length).toBe(before.length);
      let changed = 0;
      for (let offset = 0; offset < before.length; offset += 1) {
        if (before[offset] !== after[offset]) changed += 1;
      }
      return changed / before.length;
    };
    const settle = (first: Uint8Array) => {
      let previous = first;
      return waitFor(async () => {
        const current = await capture();
        if (difference(previous, current) < 0.0002) return current;
        previous = current;
      }, 15_000);
    };
    let showScale = false;
    try {
      showScale = (await menu(probe, "View", "Show Scale"))?.enabled === true;
      if (showScale) await probe.press(bundle, "View", "Show Scale");
      const original = await settle(await capture()).catch((cause) => {
        throw new Error("Maps did not settle before zooming", { cause });
      });
      await app.runChecked(key);
      const changed = await waitFor(async () => {
        const current = await capture();
        return difference(original, current) > 0.0005 ? current : undefined;
      }, 15_000).catch((cause) => {
        throw new Error("Maps did not visibly change after Zoom " + direction, { cause });
      });
      await settle(changed);
    } finally {
      if (showScale) await probe.press(bundle, "View", "Hide Scale");
      await rm(directory, { recursive: true, force: true });
    }
  };
}

async function printMap(app: ChordApp, probe: MacOSProbe, key: string) {
  const sheet = async () => {
    const current = await probe.window(bundle, 8);
    const windows = await probe.windows(bundle, 8);
    return flattenAX([current, ...windows]).find(
      (node) =>
        ["AXSheet", "AXWindow"].includes(node.role ?? "") &&
        flattenAX(node.children ?? []).some(
          (child) =>
            child.role === "AXButton" && [child.title, child.description].includes("Print"),
        ),
    );
  };
  expect(await sheet()).toBeUndefined();
  try {
    await app.runChecked(key);
    await waitFor(sheet, 15_000).catch(async (cause) => {
      const controls = flattenAX(await probe.windows(bundle, 7))
        .filter(({ role }) => ["AXWindow", "AXSheet", "AXButton"].includes(role ?? ""))
        .map(({ role, title, description }) => ({ role, title, description }));
      throw new Error(
        "Maps did not open the print panel: " + JSON.stringify(controls.slice(0, 30)),
        { cause },
      );
    });
  } finally {
    if (await sheet()) {
      await probe.pressControl(bundle, "AXButton", "Cancel");
      await waitFor(async () => ((await sheet()) ? undefined : true));
    }
  }
}

const cases: Record<string, Behavior> = {
  wn: newWindow,
  js: focusSearch,
  me: viewMode("Explore"),
  md: viewMode("Driving"),
  mt: viewMode("Transit"),
  ms: viewMode("Satellite"),
  vd: toggleView("Directions"),
  vm: toggleView("3D Map"),
  vc: toggleView("Scale"),
  fp: printMap,
  sa: openSettings,
  zi: zoomMap("In"),
  zo: zoomMap("Out"),
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
          const main = await probe.window(bundle);
          return (
            (main.id === "SceneWindow" && (await menu(probe, "File", "New Window"))?.enabled) ||
            undefined
          );
        }, 30_000);
        const failures: string[] = [];
        for (const [key, behavior] of Object.entries(cases)) {
          try {
            if ((await probe.front()) !== bundle) await probe.activate(bundle);
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
