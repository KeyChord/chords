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

const bundleId = "com.apple.findmy";

type BindingCase = (app: ChordApp, probe: MacOSProbe) => Promise<void>;

function tab(sequence: string, section: string, previous: string): BindingCase {
  return async (app, probe) => {
    const selected = async (label: string) => {
      const nodes = flattenAX([await probe.window(bundleId, 9)]);
      return (
        nodes.some(
          (node) =>
            [node.title, node.description].includes(label) &&
            (node.selected === true ||
              (["AXRadioButton", "AXTab", "AXCheckBox"].includes(node.role ?? "") &&
                (node.value === 1 || node.value === true))),
        ) || Boolean((await probe.menu(bundleId, "View", label)).mark)
      );
    };
    await probe.press(bundleId, "View", previous);
    await waitFor(
      async () => ((await selected(previous)) && !(await selected(section))) || undefined,
    );
    try {
      await app.runChecked(sequence);
      await waitFor(async () => (await selected(section)) || undefined);
    } finally {
      await probe.press(bundleId, "View", previous);
    }
  };
}

function mode(sequence: string, name: string, previous: string): BindingCase {
  return async (app, probe) => {
    const mapMode = (name: string) => probe.menu(bundleId, "View", "Map Mode", name);
    await probe.press(bundleId, "View", "Map Mode", previous);
    await waitFor(async () => (await mapMode(previous)).mark);
    try {
      await app.runChecked(sequence);
      await waitFor(async () => (await mapMode(name)).mark);
    } finally {
      await probe.press(bundleId, "View", "Map Mode", previous);
    }
  };
}

function option(sequence: string, name: string): BindingCase {
  return async (app, probe) => {
    const state = async () => {
      const nodes = flattenAX([await probe.menu(bundleId, "View", "Map Mode")]);
      const item = nodes.find(
        (node) =>
          node.role === "AXMenuItem" &&
          [name, `Show ${name}`, `Hide ${name}`].includes(node.title ?? ""),
      );
      if (!item?.title || !item.enabled) throw new Error(`Missing enabled map option ${name}`);
      return { title: item.title, mark: item.mark };
    };
    await probe.press(bundleId, "View", "Map Mode", "Satellite");
    await waitFor(async () => (await probe.menu(bundleId, "View", "Map Mode", "Satellite")).mark);
    const before = await state();
    try {
      await app.runChecked(sequence);
      await waitFor(async () => {
        const after = await state();
        return after.title !== before.title || after.mark !== before.mark || undefined;
      });
      await app.runChecked(sequence);
      await waitFor(async () => {
        const after = await state();
        return (after.title === before.title && after.mark === before.mark) || undefined;
      });
    } finally {
      await probe.press(bundleId, "View", "Map Mode", "Explore");
    }
  };
}

const cases: Record<string, BindingCase> = {
  gp: tab("gp", "People", "Devices"),
  gd: tab("gd", "Devices", "People"),
  gi: tab("gi", "Items", "People"),
  me: mode("me", "Explore", "Satellite"),
  ms: mode("ms", "Satellite", "Explore"),
  mt: option("mt", "Traffic"),
  ml: option("ml", "Labels"),
  ls: async (app, probe) => {
    await probe.press(bundleId, "View", "People");
    expect((await probe.menu(bundleId, "View", "Share My Location")).enabled).toBe(false);
    await app.expectFailure("ls", /Menu item "Share My Location".*is disabled/);
  },
};

const definition = Bun.TOML.parse(
  await Bun.file(new URL("../chords/com/apple/findmy/macos.toml", import.meta.url)).text(),
) as { chords: Record<string, unknown> };

test("every Find My binding has a behavior case", () => {
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(Object.keys(cases).sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Find My chords switch lists and map modes in the app",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundleId);
        await waitFor(async () => {
          const nodes = flattenAX(await probe.windows(bundleId, 9));
          const welcome = nodes.some((node) =>
            /Welcome to Find My|What’s New in Find My/.test(node.title ?? String(node.value ?? "")),
          );
          if (welcome) {
            if (nodes.some((node) => node.role === "AXButton" && node.title === "Continue")) {
              await probe.pressControl(bundleId, "AXButton", "Continue");
            }
            return;
          }
          return (
            nodes.some((node) => [node.title, node.description].includes("People")) || undefined
          );
        }, 15_000);

        const failures: string[] = [];
        for (const [sequence, run] of Object.entries(cases)) {
          try {
            await run(app, probe);
            console.log(`Find My ${sequence} passed`);
          } catch (error) {
            failures.push(`Find My ${sequence}: ${error}`);
          }
        }
        if (failures.length) throw new Error(failures.join("\n"));
      }),
    );
  },
  240_000,
);
