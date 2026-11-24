import { expect, test } from "bun:test";
import {
  flattenAX,
  macOSUITestsEnabled,
  waitFor,
  withChordPackage,
  withMacOSProbe,
} from "@keychord/chordtest";

const bundle = "com.apple.BluetoothFileExchange";
const files = {
  fs: { item: "Send File…", control: "Send" },
  fb: { item: "Browse Device…", control: "Browse" },
};

test("every Bluetooth File Exchange binding has a behavior case", async () => {
  const definition = Bun.TOML.parse(
    await Bun.file(
      new URL("../chords/com/apple/BluetoothFileExchange/macos.toml", import.meta.url),
    ).text(),
  ) as { chords: Record<string, unknown> };
  expect(
    Object.keys(definition.chords)
      .filter((key) => !key.startsWith("?"))
      .sort(),
  ).toEqual([...Object.keys(files), "gs"].sort());
});

test.skipIf(!macOSUITestsEnabled)(
  "Bluetooth File Exchange chords reach the file picker, device chooser, and settings",
  async () => {
    console.log(
      "guest macOS",
      Bun.spawnSync(["sw_vers", "-productVersion"]).stdout.toString().trim(),
    );
    await withChordPackage(import.meta.url, (app) =>
      withMacOSProbe(async (probe) => {
        await probe.activate(bundle);
        await waitFor(() => probe.menu(bundle, "File").catch(() => undefined), 15_000);
        const controls = async () => flattenAX(await probe.windows(bundle, 8));
        const button = async (label: string) =>
          (await controls()).find(
            (node) => node.role === "AXButton" && [node.title, node.description].includes(label),
          );
        if (await button("Cancel")) await probe.pressControl(bundle, "AXButton", "Cancel");
        await waitFor(async () => ((await button("Cancel")) ? undefined : true), 12_000);

        for (const [sequence, { item, control }] of Object.entries(files)) {
          if ((await probe.menu(bundle, "File", item)).enabled === false) {
            await app.expectFailure(sequence, /Menu item .* is disabled/);
            continue;
          }
          expect(await button(control)).toBeUndefined();
          try {
            await app.runChecked(sequence);
            await waitFor(async () => {
              const nodes = await controls();
              return nodes.find((node) => {
                const labels = [node.title, node.description, node.value];
                return (
                  (node.role === "AXButton" && labels.includes(control)) ||
                  labels.some(
                    (text) =>
                      typeof text === "string" &&
                      /Bluetooth (?:is (?:off|not available)|hardware is no longer available)/i.test(
                        text,
                      ),
                  )
                );
              });
            }, 12_000);
          } finally {
            if (await button("Cancel")) await probe.pressControl(bundle, "AXButton", "Cancel");
            else if (await button("OK")) await probe.pressControl(bundle, "AXButton", "OK");
            await waitFor(async () => ((await button(control)) ? undefined : true));
          }
        }

        const settings = async () =>
          (await probe.windows(bundle)).find(
            (node) => node.title === "Bluetooth File Exchange Settings",
          );
        expect(await settings()).toBeUndefined();
        if ((await probe.menu(bundle, "Bluetooth File Exchange", "Settings…")).enabled === false) {
          await app.expectFailure(
            "gs",
            /Menu item "Settings…" in path "Bluetooth File Exchange > Settings…" is disabled/,
          );
          expect(await settings()).toBeUndefined();
          return;
        }
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
