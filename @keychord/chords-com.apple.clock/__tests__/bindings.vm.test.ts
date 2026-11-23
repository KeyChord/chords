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

const bundleId = "com.apple.clock";

type Scenario = {
  keys: string[];
  run: (app: ChordApp, probe: MacOSProbe) => Promise<void>;
};

async function until(check: () => Promise<boolean>, state: string) {
  await waitFor(async () => ((await check()) ? true : undefined), 10_000).catch((cause) => {
    throw new Error("Expected " + state, { cause });
  });
}

async function nodes(probe: MacOSProbe) {
  return flattenAX(await probe.windows(bundleId, 8));
}

async function prepare(probe: MacOSProbe) {
  if (
    (await nodes(probe)).some((node) => [node.title, node.value].includes("What’s New in Clock"))
  ) {
    await probe.pressControl(bundleId, "AXButton", "Continue");
  }
  await until(
    async () => (await probe.menu(bundleId, "View", "World Clock")).enabled === true,
    "the Clock view menu",
  );
}

const tabs = { gw: "World Clock", ga: "Alarms", gs: "Stopwatch", gt: "Timers" };
const faces = { va: "View Analog Stopwatch", vd: "View Digital Stopwatch" };

async function activeTab(probe: MacOSProbe) {
  return flattenAX([await probe.menu(bundleId, "View")]).find(
    (node) => node.mark && Object.values(tabs).includes(node.title ?? ""),
  )?.title;
}

const scenarios: Record<string, Scenario> = {
  "switches between all four tabs": {
    keys: Object.keys(tabs),
    async run(app, probe) {
      const labels = Object.values(tabs);
      const current = () => activeTab(probe);
      const original = await waitFor(current, 10_000);
      try {
        for (const [key, label] of Object.entries(tabs)) {
          if ((await current()) === label) {
            const other = labels.find((candidate) => candidate !== label)!;
            await probe.press(bundleId, "View", other);
            await until(async () => (await current()) === other, other + " to be active");
          }
          await app.runChecked(key);
          await until(async () => (await current()) === label, label + " to be active");
        }
      } finally {
        await probe.press(bundleId, "View", original);
        await until(async () => (await current()) === original, original + " to be restored");
      }
    },
  },
  "switches between analog and digital stopwatch faces": {
    keys: Object.keys(faces),
    async run(app, probe) {
      const originalTab = await waitFor(() => activeTab(probe));
      await probe.press(bundleId, "View", "Stopwatch");
      await until(async () => (await activeTab(probe)) === "Stopwatch", "the Stopwatch tab");
      const marked = async (label: string) =>
        Boolean((await probe.menu(bundleId, "View", label)).mark);
      const original = (await marked(faces.va)) ? faces.va : faces.vd;
      try {
        for (const [key, label] of Object.entries(faces)) {
          if (await marked(label)) {
            const other = label === faces.va ? faces.vd : faces.va;
            await probe.press(bundleId, "View", other);
            await until(() => marked(other), other + " to be selected");
          }
          await app.runChecked(key);
          await until(() => marked(label), label + " to be selected");
        }
      } finally {
        await probe.press(bundleId, "View", original);
        await until(() => marked(original), original + " to be restored");
        await probe.press(bundleId, "View", originalTab);
        await until(async () => (await activeTab(probe)) === originalTab, "the original tab");
      }
    },
  },
};

test("every Clock binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(new URL("../chords/com/apple/clock/macos.toml", import.meta.url)).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual(
    Object.values(scenarios)
      .flatMap(({ keys }) => keys)
      .sort(),
  );
});

for (const [name, { run }] of Object.entries(scenarios)) {
  test.skipIf(!macOSUITestsEnabled)(
    "Clock " + name,
    async () => {
      console.log(
        "guest macOS",
        Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
      );
      await withChordPackage(import.meta.url, (app) =>
        withMacOSProbe(async (probe) => {
          await probe.activate(bundleId);
          await until(async () => (await probe.windows(bundleId)).length > 0, "the main window");
          try {
            await prepare(probe);
            await run(app, probe);
          } catch (cause) {
            console.error(
              "Clock windows",
              JSON.stringify(await probe.windows(bundleId, 5).catch(() => [])).slice(0, 6_000),
            );
            throw cause;
          }
        }),
      );
    },
    180_000,
  );
}
