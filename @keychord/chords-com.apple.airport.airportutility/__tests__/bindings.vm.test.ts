import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.airport.airportutility";
const dialogs = {
  fc: { path: ["File", "Configure Other..."], label: /^Enter the address and password/ },
  fi: { path: ["File", "Import Configuration File..."], label: /^(Open|Import|Choose)$/ },
  fe: { path: ["File", "Export Configuration File..."], label: /^Save$/ },
};
const zoom = {
  zi: "Zoom In",
  zo: "Zoom Out",
  za: "Actual Size",
};

test("every AirPort Utility binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/airport/airportutility/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...Object.keys(dialogs), ...Object.keys(zoom), "gs"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "AirPort Utility chords open configuration dialogs and settings",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(() => probe.window(bundle).catch(() => undefined), 15_000);
        for (const [sequence, { path, label }] of Object.entries(dialogs)) {
          const item = await probe.menu(bundle, ...path);
          if (sequence !== "fc" && item.enabled === false) {
            await app.expectFailure(sequence, /Menu item .* is disabled/);
            continue;
          }

          const dialog = async () =>
            flattenAX(await probe.windows(bundle, 8)).find((node) =>
              [node.title, node.description, node.value].some(
                (text) => typeof text === "string" && label.test(text),
              ),
            );
          expect(await dialog()).toBeUndefined();
          try {
            await app.runChecked(sequence);
            await waitFor(dialog, 12_000);
          } finally {
            await probe.key(53);
            await waitFor(async () => ((await dialog()) ? undefined : true), 12_000);
          }
        }

        const settings = async () =>
          (await probe.windows(bundle)).find(
            (window) => window.title === "AirPort Utility Settings",
          );
        expect(await settings()).toBeUndefined();
        try {
          await app.runChecked("gs");
          await waitFor(settings, 12_000);
        } finally {
          if (await settings()) await probe.key(13, 1 << 20);
          await waitFor(async () => ((await settings()) ? undefined : true));
        }
      }),
    );
  },
  120_000,
);

test.skipIf(!macOSUITestsEnabled)(
  "AirPort Utility zoom chords change the topology scale",
  async () => {
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(() => probe.window(bundle).catch(() => undefined), 15_000);
        const actualSize = () => probe.menu(bundle, "View", zoom.za);
        const resetZoom = async () => {
          if ((await actualSize()).enabled) await probe.press(bundle, "View", zoom.za);
          await waitFor(async () => ((await actualSize()).enabled === false ? true : undefined));
        };
        await resetZoom();
        try {
          for (const sequence of ["zi", "zo"] as const) {
            const item = await probe.menu(bundle, "View", zoom[sequence]);
            if (item.enabled === false) {
              await app.expectFailure(sequence, /Menu item .* is disabled/);
              continue;
            }

            await app.runChecked(sequence);
            await waitFor(async () => ((await actualSize()).enabled ? true : undefined));
            await app.runChecked("za");
            await waitFor(async () => ((await actualSize()).enabled === false ? true : undefined));
          }
          if (
            (await probe.menu(bundle, "View", zoom.zi)).enabled === false &&
            (await probe.menu(bundle, "View", zoom.zo)).enabled === false
          ) {
            await app.expectFailure("za", /Menu item .* is disabled/);
          }
        } finally {
          await resetZoom();
        }
      }),
    );
  },
  120_000,
);
